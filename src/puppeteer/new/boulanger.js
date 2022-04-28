const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');

const phoneVendorUrl = 'https://www.boulanger.com';
const phoneVendorSearchUrl = 'https://www.boulanger.com/c/nav-filtre/resultats?tr=%phoneUrl%&_etat_produit~neuf|_usage~smartphone#searchinputmode=autre_ref';

/**
 * Main function to scrap boulanger
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('boulanger START');

    await page.waitFor(Math.random() * 500 + 200);
    await search(page, phone, phoneSearchConstraint);

    await page.waitFor(Math.random() * 500 + 200);
    await getPhoneFromSearch(page, phone);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page);

    console.log('boulanger END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on boulanger
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  // Search using POST datas (not using search bar)
  const phoneSearch = encodeURIComponent(phone.toString(phoneSearchConstraint));
  console.log('boulanger search', phoneSearch);
  const phoneUrl = phoneSearch.replace(' ', '+');
  const seachUrl = phoneVendorSearchUrl.replace('%phoneUrl%', phoneUrl);

  console.log('boulanger goto', seachUrl);
  await Promise.all([
    page.waitForSelector('div.main-title', {
      timeout: 0
    }),
    page.goto(seachUrl, {
      timeout: 0
    })
  ]);

  // Check if boulanger found a phone
  await page.bringToFront();
  if (await page.$('div.main-title') != null) {
    var hasResults = await page.evaluate(() => {
      const mainTitle = document.querySelector('div.main-title');
      const mainTitle_NoResult = mainTitle && (
        mainTitle.innerHTML.trim().startsWith('0 résultat') ||
        mainTitle.innerHTML.trim().startsWith('Aucun résultat'));

      const pMdri = document.querySelector('div.ems p.mdri');
      const pMdri_NoResult = pMdri && pMdri.innerText.trim().startsWith('Oups');

      return !(mainTitle_NoResult || pMdri_NoResult);
    });

    if (!hasResults) {
      throw new Error(ScrapErrors.NO_RESULT_FOUND);
    }
  }
}

/**
 * Find the phone in boulanger search result
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function getPhoneFromSearch(page, phone) {
  console.log('boulanger select in result list');
  // Check if boulanger found only one product (and already open detailed page), or a list of products
  if (page.url().indexOf('/ref/') == -1) {
    // Click on first result founded TODO check equivalency with
    await page.bringToFront();
    const hrefResult = await page.$eval('#content > div.contenu.borderSEO > div.blocListe > div.productListe > div.product:nth-child(1) > div.designations > h2 > a', (searchResult) => {
      return searchResult.getAttribute('href');
    });

    await Promise.all([
      page.waitForSelector('div.middle > div.left > div.top > div > h1', {
        timeout: 0
      }),
      page.goto(phoneVendorUrl + hrefResult, {
        delay: Math.random() * 200 + 50,
        timeout: 0
      })
    ]);
  }
}

/**
 * Parse boulanger result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  // No need to use artoo. Load JQuery and use it to get price and vendorLabel
  console.log('boulanger parse result');
  await page.addScriptTag({
    url: 'https://code.jquery.com/jquery-3.2.1.min.js'
  });
  await page.bringToFront();
  const parsedDatas = await page.evaluate((gradeToCRCondition) => {
    var result = {
      vendorLabel: $('div.middle > div.left > div.top > div > h1').text().trim(),
      isPromo: false,
      price: parseFloat($('.informations .price > .fix-price').text()
        .replace('€', '')
        .replace(',', '.')
        .trim())
    };

    if (!$('.informations .price > .productStrikeoutPrice').hasClass('off')) {
      result.isPromo = true;
      result.oldPrice = parseFloat($('.informations .price > .productStrikeoutPrice > .priceBarre').text()
        .replace('€', '')
        .replace(',', '.')
        .trim());
    }

    return result;
  }, config.cashandrepair.condition_equivalence);

  return parsedDatas;
}

module.exports = {
  scrap
}
