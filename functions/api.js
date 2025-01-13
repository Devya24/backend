const express = require('express');
const serverless = require('serverless-http');
const app = express();
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const chromium = require('chrome-aws-lambda');
const { body, validationResult } = require('express-validator'); // Input validation

// Validate the presence of SendGrid API key
if (!process.env.SEND_GRID_API_KEY) {
  console.error('SEND_GRID_API_KEY is not defined. Please set it in the environment variables.');
  process.exit(1);
}
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);

// Middleware
app.use(bodyParser.json());

// Helper function to generate a PDF from HTML
const generatePDF = async (htmlContent) => {
  try {
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    await browser.close();
    return Buffer.from(pdfBuffer).toString('base64');
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw new Error('Failed to generate PDF.');
  }
};

// Default route to confirm the API is running
router.get('/', (req, res) => {
  res.send('App is running..');
});

// API to send email with PDF attachment
router.post(
  '/send-mail',
  [
    body('to').isEmail().withMessage('A valid recipient email is required.'),
    body('subject').notEmpty().withMessage('Subject is required.'),
    body('content').notEmpty().withMessage('Content is required.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, subject, content } = req.body;

    // Define email HTML content
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
              margin: 0;
              padding: 0;
              background-color: #f4f4f9;
            }
            .container {
              width: 100%;
              max-width: 600px;
              margin: 0 auto;
              background: #fff;
              border-radius: 8px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: #007bff;
              color: #fff;
              text-align: center;
              padding: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 20px;
              line-height: 1.5;
            }
            .footer {
              text-align: center;
              padding: 10px;
              background: #f8f8f8;
              font-size: 12px;
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
      // Generate PDF
      const pdfBuffer = await generatePDF(htmlContent);

      // Email configuration
      const msg = {
        to, // Recipient email
        from: 'developer@devya.in', // Sender email
        subject, // Email subject
        text: content, // Plain text content
        html: htmlContent, // HTML content
        attachments: [
          {
            content: pdfBuffer,
            filename: 'email-content.pdf',
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ],
      };

      // Send email using SendGrid
      await sgMail.send(msg);
      res.status(200).json({ message: 'Email with PDF sent successfully!' });
    } catch (error) {
      console.error('SendGrid Error:', error.response ? error.response.body : error);
      res.status(500).json({
        error: 'Failed to send email.',
        details: error.response ? error.response.body : error.message,
      });
    }
  }
);

app.use('/.netlify/functions/api', router);

module.exports.handler = serverless(app);
