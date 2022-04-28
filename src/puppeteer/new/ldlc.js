const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');

const phoneVendorUrl = 'https://www.ldlc.com';

/**
 * Main function to scrap ldlc
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('ldlc START');
    // Goto ldlc, waiting page to be fully loaded
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto(phoneVendorUrl, {
        timeout: 0
      })
    ]);

    await page.waitFor(Math.random() * 500 + 200);
    await search(page, phone, phoneSearchConstraint);

    await page.waitFor(Math.random() * 500 + 200);
    await getPhoneFromSearch(page, phone);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page);

    console.log('ldlc END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on ldlc
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  // Focus searchField and make user search
  phoneSearchConstraint.withQuotes = false; // ldlc doesn't accept quotes
  const phoneSearch = phone.toString(phoneSearchConstraint);
  console.log('ldlc search', phoneSearch);
  await page.bringToFront();
  await page.focus('#search_search_text');
  await page.keyboard.type(phoneSearch, {
    delay: 100
  });
  await page.waitFor(Math.floor(Math.random() * 100 + 50));
  await page.bringToFront();

  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('#formSearch > div > div.wrap-search > div.search > button', {
      delay: Math.random() * 200 + 50
    }),
  ]);
  await page.waitFor(Math.random() * 1000 + 500);
  await page.bringToFront();

  // Check if ldlc found a phone
  const hasResults = (await page.$('#listing.no-result') == null);
  if (!hasResults) {
    throw new Error(ScrapErrors.NO_RESULT_FOUND);
  }
}

/**
 * Find the phone in ldlc search result
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function getPhoneFromSearch(page, phone) {
  console.log('ldlc select in result list');
  // Check if ldlc found only one product (and already open detailed page), or a list of products
  if (page.url().indexOf('recherche') != -1) {
    // Reload page with category "Mobile & smartphone" (+fcat-4416) and condition "neuf" (+fiu-0)
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto(page.url() + '+fcat-4416+fiu-0.html?department=all', {
        timeout: 0
      })
    ]);

    // Check again if ldlc found a phone with constraints
    const hasResults = (await page.$('#listing.no-result') == null);
    if (!hasResults) {
      throw new Error(ScrapErrors.NO_RESULT_FOUND);
    }

    // Click on first result founded TODO check equivalency with
    await page.waitForSelector('#listing > div.wrap-list > div.listing-product > ul > li:nth-child(1) > div.dsp-cell-right > div.pdt-info > div.pdt-desc > h3 > a', {
      timeout: 0
    });
    await page.bringToFront();
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.click('#listing > div.wrap-list > div.listing-product > ul > li:nth-child(1) > div.dsp-cell-right > div.pdt-info > div.pdt-desc > h3 > a')
    ]);
  }
}

/**
 * Parse ldlc result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('ldlc parse result');
  // No need to use artoo. As JQuery is already loaded, use it to get price and vendorLabel
  await page.bringToFront();
  var parsedDatas = await page.evaluate((gradeToCRCondition) => {
    const priceDOM = ($('aside > div.price > div.price').length != 0) ?
      $('aside > div.price > div.price') : // Normal case
      $('aside > div.price > div.new-price'); // Price reduction case

    var result = {
      vendorLabel: $('#activeOffer > div.title > h1').text().trim(),
      available: ($('.stock').text().trim() == 'En stock'),
      availability: $('.stock').text().trim(),
      isPromo: false,
      price: parseFloat(priceDOM.text()
        .replace(' ', '')
        .replace('€', '.'))
    };

    if ($('.main div.price > div.old-price').length > 0) {
      result.isPromo = true;
      result.oldPrice = parseFloat($('.main div.price > div.old-price').text()
        .replace('€', '.'));
    }
    if ($('.main div.price > div.promo-timeout').length > 0) {
      result.promo = $('.main div.price > div.promo-timeout').text();
    }

    return result;
  }, config.cashandrepair.condition_equivalence);

  return parsedDatas;
}

module.exports = {
  scrap
}
