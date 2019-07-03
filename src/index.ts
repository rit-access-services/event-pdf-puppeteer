import { resolve } from 'path';

import AWS from 'aws-sdk';
import { config } from 'dotenv';
import slugify from 'slugify';

import { PDFParser } from './PDFParser';

config({ path: resolve(__dirname, '../.env') });

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

type PDFParseEvent = {
  url: string;
  key: string;
};

export async function handler({ url, key }: PDFParseEvent) {
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
    }
    if (data) {
      // TODO POST to daspdp.org api
      console.log('Upload Success', data.Location);
    }
  });
}
