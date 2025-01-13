const express = require("express");
const serverless = require("serverless-http");
const app = express();
const router = express.Router();
const sgMail = require("@sendgrid/mail");
const bodyParser = require("body-parser");
const chromium = require('chrome-aws-lambda');

// Validate the presence of SendGrid API key
if (!process.env.SEND_GRID_API_KEY) {
  console.error(
    "SEND_GRID_API_KEY is not defined. Please set it in the environment variables."
  );
  process.exit(1);
}
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);

// Middleware
app.use(bodyParser.json());

const generatePDF = async (htmlContent) => {
  try {
    const browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await chromium.executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return Buffer.from(pdfBuffer).toString('base64');
  } catch (error) {
    console.error('Error launching browser:', error);
    throw error;
  }
};

// Default route to confirm the API is running
router.get("/", (req, res) => {
  res.send("App is running..");
});

// API to send email with PDF attachment
router.post("/send-mail", async (req, res) => {
  const { to, subject, content } = req.body;

  // Define email HTML content
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Agreement</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Roboto', sans-serif;
            background-color: #f3f4f6;
        }

        .page {
            width: 210mm;
            height: 297mm;
            margin: 20px auto;
            padding: 30px;
            background: white;
            border: 15px double #4a5568;
            border-radius: 10px;
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2);
            box-sizing: border-box;
            position: relative;
        }

        .header {
            display: flex;
            justify-content: flex-end;
            font-size: 12px;
            margin-bottom: 20px;
            color: #2d3748;
        }

        .header .location {
            text-align: right;
            font-style: italic;
        }

        .content {
            text-align: justify;
            line-height: 1.8;
            font-size: 14px;
            color: #2d3748;
            margin-bottom: 50px;
        }

        .content h2 {
            text-align: center;
            text-decoration: underline;
            margin-bottom: 20px;
            font-size: 18px;
            color: #1a202c;
        }

        .footer {
            position: absolute;
            bottom: 30px;
            left: 30px;
            right: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }

        .footer .signature {
            text-align: center;
            border-top: 1px solid #2d3748;
            width: 200px;
            padding-top: 5px;
        }

        @media print {
            body {
                background-color: white;
            }

            .page {
                box-shadow: none;
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <div class="page">
        <!-- Header Section -->
        <div class="header">
            <div class="location">
                <p><strong>Location:</strong> Bangalore</p>
                <p><strong>Address:</strong> 123, Tech Park, MG Road, Bangalore, India</p>
                <p><strong>Date:</strong> January 13, 2025</p>
            </div>
        </div>

        <!-- Content Section -->
        <div class="content">
            <h2>E-Agreement</h2>
            <p>
                This agreement is made and entered into by and between the parties mentioned herein. The user agrees to the terms and conditions set forth in this document. All user details and documents are provided below for validation and agreement.
            </p>
            <p>
                <strong>User Details:</strong><br>
                Name: John Doe<br>
                Email: john.doe@example.com<br>
                Phone: +91-9876543210<br>
                Address: 456, Silicon Valley, Bengaluru, India.
            </p>
            <p>
                <strong>Documents:</strong><br>
                1. Identity Proof: Passport<br>
                2. Address Proof: Utility Bill<br>
                3. Agreement Copy
            </p>
        </div>

        <!-- Footer Section -->
        <div class="footer">
            <div class="signature">
                <p>User Signature</p>
            </div>

            <div class="signature">
                <p>Authorized Signature</p>
            </div>
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
      from: "developer@devya.in", // Sender email
      subject, // Email subject
      text: content, // Plain text content
      html: htmlContent, // HTML content
      attachments: [
        {
          content: pdfBuffer,
          filename: "email-content.pdf",
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    // Send email using SendGrid
    await sgMail.send(msg);
    res.status(200).json({ message: "Email with PDF sent successfully!" });
  } catch (error) {
    console.error(
      "SendGrid Error:",
      error.response ? error.response.body : error
    );
    res.status(500).json({
      error: "Failed to send email.",
      details: error.response ? error.response.body : error.message,
    });
  }
});

app.use("/.netlify/functions/api", router);

module.exports.handler = serverless(app);
