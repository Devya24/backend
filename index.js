const express = require('express');
const sgMail = require('@sendgrid/mail');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const port = 3001;
sgMail.setApiKey(process.env.SENDGRID_API_KEY);



// Middleware
app.use(bodyParser.json()); // Parse JSON request body

// Function to generate a PDF from HTML
const generatePDF = async (htmlContent) => {
  const browser = await puppeteer.launch(); // Launch Puppeteer browser
  const page = await browser.newPage(); // Open a new page
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' }); // Set the page content
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true, // Ensure background styles are included
  }); // Generate PDF
  await browser.close(); // Close the browser
  
  // Ensure the buffer is converted to a base64 string
  return Buffer.from(pdfBuffer).toString('base64');
};
// API to send email
app.post('/send-mail', async (req, res) => {
  const { to, subject, content } = req.body;
  
  // Validate input
  if (!to || !subject || !content) {
    return res.status(400).json({
      error: 'All fields (to, subject, content) are required.',
    });
  }
  
  // Define the email HTML content
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f9;
          margin: 0;
          padding: 0;
        }
        .container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
          background-color: #007bff;
          color: #fff;
          padding: 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 20px;
          line-height: 1.6;
          color: #333;
        }
        .content p {
          margin-bottom: 15px;
        }
        .footer {
          background-color: #f8f8f8;
          color: #777;
          text-align: center;
          padding: 10px;
          font-size: 0.8em;
        }
        .footer a {
          color: #007bff;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${subject}</h1>
        </div>
        <div class="content">
          <p>${content}</p>
        </div>
        <div class="footer">
          <p>&copy; Devya. All rights reserved.</p>
          <p><a href="https:/devya.in">Visit our website</a></p>
        </div>
      </div>
    </body>
  </html>
  `;

  try {
    // Generate PDF and save it locally to verify
    const pdfBuffer = await generatePDF(htmlContent);
    // Define the email content
    const msg = {
      to, // Recipient email
      from: 'developer@devya.in', // Replace with your email
      subject, // Email subject
      text: content, // Plain text content
      html: htmlContent, // HTML content
      attachments: [
        {
          content: pdfBuffer, // Attach the base64-encoded PDF content
          filename: 'email-content.pdf', // File name of the attachment
          type: 'application/pdf', // Ensure the file type is correct
          disposition: 'attachment', // Specify that it's an attachment
        },
      ],
    };
  
    // Send email using SendGrid
    await sgMail.send(msg);
    res.status(200).json({
      message: 'Email with PDF sent successfully!',
    });
  } catch (error) {
    console.error('SendGrid Error:', error.response ? error.response.body : error);
    res.status(500).json({
      error: 'Failed to send email.',
      details: error.response ? error.response.body : error.message,
    });
  }
  
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
