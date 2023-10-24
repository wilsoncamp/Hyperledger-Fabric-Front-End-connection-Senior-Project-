// backend.js

'use strict';
const express = require('express');
const app = express();
const port = 3000;

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');


const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'basic';

const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'javascriptAppUser';

function prettyJSONString(inputString) {
  return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function main(functionName, assetID, color, size, owner, appraisedValue) {
  try {
    const ccp = buildCCPOrg1();
    const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
    const wallet = await buildWallet(Wallets, walletPath);

    await enrollAdmin(caClient, wallet, mspOrg1);
    await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

    const gateway = new Gateway();
    try {
      await gateway.connect(ccp, {
        wallet,
        identity: org1UserId,
        discovery: { enabled: true, asLocalhost: true }
      });

      const network = await gateway.getNetwork(channelName);
      const contract = network.getContract(chaincodeName);

      let result;
	  if (functionName === 'InitLedger') {
		await contract.submitTransaction('InitLedger');
		result = 'Ledger initialized.';
	  } else if (functionName === 'CreateAsset') {
		const assetBuffer = await contract.submitTransaction('CreateAsset', assetID, color, size, owner, appraisedValue);
		const asset = JSON.parse(assetBuffer.toString('utf8'));
		result = 'Asset created: ' + JSON.stringify(asset, null, 2);
	 }	else if (functionName === 'ReadAsset') {
		const asset = await contract.evaluateTransaction('ReadAsset', 'asset313');
		result = 'Asset details: ' + prettyJSONString(asset.toString());
	  } else if (functionName === 'UpdateAsset') {
		await contract.submitTransaction('UpdateAsset', 'asset1', 'blue', '5', 'Tomoko', '350');
		result = 'Asset updated.';
	  } else if (functionName === 'AssetExists') {
		const exists = await contract.evaluateTransaction('AssetExists', 'asset1');
		result = 'Asset exists: ' + exists.toString();
	  } else if (functionName === 'TransferAsset') {
		const oldOwner = await contract.submitTransaction('TransferAsset', 'asset1', 'Tom');
		result = 'Asset transferred. Previous owner: ' + oldOwner;
	  } 
	  
	  else if (functionName === 'GetAllAssets') {
		const assets = await contract.evaluateTransaction('GetAllAssets');
		const assetsData = JSON.parse(assets.toString());
		
		// Create an HTML table to display the data
		let tableHTML = '<table>';
		tableHTML += '<tr><th>Asset ID</th><th>Color</th><th>Size</th><th>Owner</th><th>Appraised Value</th></tr>';
		assetsData.forEach((asset) => {
		  tableHTML += '<tr>';
		  tableHTML += `<td>${asset.ID}</td>`;
		  tableHTML += `<td>${asset.Color}</td>`;
		  tableHTML += `<td>${asset.Size}</td>`;
		  tableHTML += `<td>${asset.Owner}</td>`;
		  tableHTML += `<td>${asset.AppraisedValue}</td>`;
		  tableHTML += '</tr>';
		});
		tableHTML += '</table>';
	  
		return tableHTML; // Return the HTML table as a string
	  }
	  
	  else {
		result = 'Function not implemented.';
	  }
	  

	  

      return result;
    } 
	finally {
      gateway.disconnect();
    }
  } catch (error) {
    throw error;
  }
}

  
  


app.get('/execute-fabric-app/:functionName', async (req, res) => {
	const functionName = req.params.functionName;
  
	try {
	  if (functionName === 'CreateAsset') {
		const assetID = req.query.assetID;
		const color = req.query.color;
		const size = req.query.size;
		const owner = req.query.owner;
		const appraisedValue = req.query.appraisedValue;
  
		const result = await main('CreateAsset', assetID, color, size, owner, appraisedValue);
		res.json({ message: 'Asset created successfully', result });
	  } else {
		const result = await main(functionName);
		res.json({ message: 'Fabric application executed successfully', result });
	  }
	} catch (error) {
	  console.error(`Error executing Fabric application: ${error}`);
	  res.status(500).json({ error: 'Error executing Fabric application', details: error.message });
	}
	
  });
  
app.get('/execute-fabric-app/GetAllAssets', async (req, res) => {
	try {
	  const assets = await main('GetAllAssets'); // Call the main function
	  res.send(assets); // Return the HTML table as a response
	} catch (error) {
	  console.error(`Error executing Fabric application: ${error}`);
	  res.status(500).json({ error: 'Error executing Fabric application', details: error.message });
	}
  });



app.get('/', (req, res) => {
  // Serve the HTML page
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
