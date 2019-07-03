import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import express from 'express';
import slugify from 'slugify';
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
};

function uploadPDF({ key, pdf }: UploadPDFOptions, res: express.Response) {
  const uploadParams: AWS.S3.PutObjectRequest = {
    Bucket: process.env.AWS_BUCKET_NAME as string,
    Key: `${slugify(key)}.pdf`,
    Body: pdf,
    ACL: 'public-read',
  };

  s3.upload(uploadParams, (err, data) => {
    if (err) {
      // TODO rollbar log
      console.log('Error', err);
      res.status(400).send();
    }
    if (data) {
      // TODO POST to daspdp.org api
      console.log('Upload Success', data.Location);
      res.status(204).send();
    }
  });
}

const port = process.env.SERVER_PORT || 3531;

const app = express();
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const { key, url } = req.body;
  if (!key || !url || typeof key !== 'string' || typeof url !== 'string') {
    return res.status(400).send();
  }
  const pdf = await parsePDF(url);
  if (!pdf) {
    return res.status(400).send();
  }
  uploadPDF({ key, pdf }, res);
});

app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
