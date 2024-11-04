const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js'); // Import xml2js to parse the SOAP response
const app = express();
require('dotenv').config();

//
// .env Port Number
const port = process.env.port
// Replace your .env DiscordWebHookUrl
const discordWebHookUrl = process.env.discordWebHookUrl;

app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// Handle account creation request
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    // Construct the GM command
    const command = `account create ${username} ${password}`;

    // SOAP Request XML
    const xmlRequest = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:AC">
       <soapenv:Header/>
       <soapenv:Body>
          <urn:executeCommand>
             <command>${command}</command>
             <username>master</username>
             <password>master</password>
          </urn:executeCommand>
       </soapenv:Body>
    </soapenv:Envelope>
    `;

    // SOAP API request options
    const options = {
        hostname: '127.0.0.1',
        port: 7878,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml',
            'Content-Length': Buffer.byteLength(xmlRequest),
            'Authorization': 'Basic ' + Buffer.from('master:master').toString('base64')
        }
    };

    // Send SOAP request to AzerothCore
    const soapReq = http.request(options, (soapRes) => {
        let data = '';

        soapRes.on('data', (chunk) => {
            data += chunk;
        });

        soapRes.on('end', async () => {
            // Parse the SOAP response XML
            xml2js.parseString(data, { explicitArray: false }, async (err, result) => {
                if (err) {
                    console.error('Error parsing SOAP response:', err.message);
                    res.status(500).json({ success: false, message: 'Internal server error' });

                    // Send error to Discord WebHook
                    axios.post(discordWebHookUrl, {
                        content: `Error parsing SOAP response: ${err.message}\nEmail: ${email}`
                    }).then(() => {
                        console.log('Error sent to Discord WebHook');
                    }).catch((error) => {
                        console.error('Error sending error to Discord WebHook:', error.message);
                    });

                    return;
                }

                // Send the entire parsed response to Discord WebHook
                const formattedResponse = `**SOAP Response**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n**Email:** ${email}`;

                try {
                    await axios.post(discordWebHookUrl, {
                        content:  formattedResponse
                    });
                    console.log('SOAP Response sent to Discord WebHook');
                } catch (error) {
                    console.error('Error sending SOAP Response to Discord WebHook:', error.message);
                }

                // Send a generic success response to the client
                res.status(200).json({ success: true, message: 'Account creation request sent' });
            });
        });
    });

    soapReq.on('error', (e) => {
        console.error('Error executing SOAP command:', e.message);
        res.status(500).json({ success: false, message: 'Internal server error' });

        // Format the error message for Discord WebHook
        const formattedError = `**Error executing SOAP command**\n\`\`\`\n${e.message}\n\`\`\`\n**Email:** ${email}`;

        // Send formatted error to Discord WebHook
        axios.post(discordWebHookUrl, {
            content: formattedError
        }).then(() => {
            console.log('Error sent to Discord WebHook');
        }).catch((error) => {
            console.error('Error sending error to Discord WebHook:', error.message);
        });
    });

    soapReq.write(xmlRequest);
    soapReq.end();
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(port)

});
