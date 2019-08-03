import puppeteer from 'puppeteer';

export type PDFParserOptions = {
  browser: puppeteer.Browser;
  pdfConfig?: puppeteer.PDFOptions;
};

export class PDFParser {
  browser: puppeteer.Browser;

  public pdfConfig: puppeteer.PDFOptions = {
    format: 'Letter',
    printBackground: true,
  };

  constructor({ browser, pdfConfig }: PDFParserOptions) {
    this.browser = browser;
    if (pdfConfig) {
      this.pdfConfig = pdfConfig;
    }
  }

  public static async build(pdfConfig?: puppeteer.PDFOptions) {
    // Puppeteer can only generate pdfs in headless mode.
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    return new PDFParser({ browser, pdfConfig });
  }

  public async generatePDF(url: string) {
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.emulateMedia('screen');
    const pdf = await page.pdf(this.pdfConfig);

    return pdf;
  }

  public async closeBrowser() {
    return await this.browser.close();
  }
}
