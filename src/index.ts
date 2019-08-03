import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import express from 'express';
import slugify from 'slugify';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';

import { PDFParser } from './PDFParser';

dotenv.config();

const requiredEnvironmentVariables = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_BUCKET_NAME',
];

for (let variable of requiredEnvironmentVariables) {
  if (!process.env[variable]) {
    throw new Error(
      `\`${variable}\` environment variable not found. Check that \`.env\` file is properly set.`
    );
  }
}

const credentials = new AWS.Credentials({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
});

AWS.config.credentials = credentials;

const s3 = new AWS.S3({
  region: 'us-east-1',
  apiVersion: '2006-03-01',
});

async function parsePDF(url: string) {
  let pdf: Buffer | undefined = undefined;

  const pdfParser = await PDFParser.build();

  try {
    pdf = await pdfParser.generatePDF(url);
  } catch (err) {
    // TODO rollbar log
    console.log('Puppeteer Error', err);
  } finally {
    await pdfParser.closeBrowser();
  }

  if (!pdf) {
  }
  return pdf;
}

type UploadPDFOptions = {
  key: string;
  pdf: Buffer;
  eventId: string;
  token: string;
  callbackUrl: string;
};

function uploadPDF(
  { key, pdf, eventId, token, callbackUrl }: UploadPDFOptions,
  res: express.Response
) {
  const uploadParams: AWS.S3.PutObjectRequest = {
    Bucket: process.env.AWS_BUCKET_NAME as string,
    Key: `${slugify(key)}.pdf`,
    Body: pdf,
    ACL: 'public-read',
  };

  s3.upload(uploadParams, async (err, data) => {
    if (err) {
      // TODO rollbar log
      console.log('Error', err);
      res.status(400).send({ error: 'S3 Upload Failed' });
    }
    if (data) {
      // TODO POST to daspdp.org api
      console.log('Upload Success', data.Location);
      const response = await fetch(callbackUrl, {
        method: 'POST',
        body: JSON.stringify({
          pdfUrl: data.Location,
          token,
        }),
      });
      if (response.ok) {
        res.status(204).send();
      } else {
        res.status(400).send({
          error: `PDF link ${data.Location} to Event ${eventId} failed`,
        });
      }
    }
  });
}

const port = process.env.PORT || 3531;

const app = express();
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const { key, puppeteerUrl, callbackUrl, eventId, token } = req.body;
  if (
    !key ||
    !puppeteerUrl ||
    !callbackUrl ||
    !eventId ||
    !token ||
    typeof key !== 'string' ||
    typeof puppeteerUrl !== 'string' ||
    typeof callbackUrl !== 'string' ||
    typeof token !== 'string' ||
    !['string', 'number'].includes(typeof eventId)
  ) {
    return res.status(400).send({ error: 'Invalid POST body' });
  }
  const pdf = await parsePDF(`${puppeteerUrl}?token=${token}`);
  if (!pdf) {
    return res.status(400).send({ error: 'Failed to generate PDF' });
  }
  uploadPDF({ key, pdf, eventId, token, callbackUrl }, res);
});

app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
