const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setLevenshteinFunction
} = require('./../scraper.js');

const phoneVendorUrl = `https://www.cdiscount.com/search/10/%phoneSearch1%.html?TechnicalForm.SiteMapNodeId=0
&TechnicalForm.DepartmentId=10&TechnicalForm.ProductId=&hdnPageType=Search
&TechnicalForm.ContentTypeId=16&TechnicalForm.SellerId=&TechnicalForm.PageType=SEARCH_AJAX
&TechnicalForm.LazyLoading.ProductSheets=False&TechnicalForm.BrandLicenseId=0
&NavigationForm.CurrentSelectedNavigationPath=categorycodepath%2F07%7C0703%7C070302
&NavigationForm.FirstNavigationLinkCount=1&FacetForm.SelectedFacets.Index=0
&FacetForm.SelectedFacets.Index=1&FacetForm.SelectedFacets.Index=2
&FacetForm.SelectedFacets.Index=3&FacetForm.SelectedFacets.Index=4
&FacetForm.SelectedFacets.Index=5&FacetForm.SelectedFacets.Index=13
&FacetForm.SelectedFacets.Index=6&FacetForm.SelectedFacets.Index=7
&FacetForm.SelectedFacets.Index=8&FacetForm.SelectedFacets.Index=9
&FacetForm.SelectedFacets.Index=10&FacetForm.SelectedFacets.Index=11
&FacetForm.SelectedFacets.Index=12&FacetForm.SelectedFacets.Index=14
&FacetForm.SelectedFacets.Index=15&FacetForm.SelectedFacets.Index=16
&FacetForm.SelectedFacets.Index=17&FacetForm.SelectedFacets.Index=18
&FacetForm.SelectedFacets.Index=19&FacetForm.SelectedFacets.Index=20
&FacetForm.SelectedFacets.Index=21&SortForm.BrandLicenseSelectedCategoryPath=
&SortForm.SelectedSort=PERTINENCE&ProductListTechnicalForm.Keyword=%phoneSearch2%
&ProductListTechnicalForm.TemplateName=InLine&&_his_`;

/**
 * Main function to scrap cdiscount
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('cdiscount START');
    // Disable js : avoid cdiscount to detect us as a robot and replace search by an add
    await page.setJavaScriptEnabled(false);

    await page.waitFor(Math.random() * 500 + 200);
    await search(page, phone, phoneSearchConstraint);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page, phone);

    console.log('cdiscount END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on cdiscount
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  console.log('cdiscount search');
  // Search using POST datas (not using search bar)
  phoneSearchConstraint.withQuotes = false;
  const phoneSearch = phone.toString(phoneSearchConstraint).toLowerCase();
  const doubleEncodedPhoneSearch = encodeURIComponent(encodeURIComponent(phoneSearch));
  const seachUrl = phoneVendorUrl.replace('%phoneSearch1%', phoneSearch)
    .replace('%phoneSearch2%', doubleEncodedPhoneSearch); // Don't ask me why cdiscount double encode this...

  page.goto(seachUrl, {
      timeout: 0
  });
  await page.waitFor(3000);
  await page.bringToFront();
  await page.evaluate(() => window.stop());

  const hasResults = (await page.$('#lpBloc > li:nth-child(2)') != null);
  if (!hasResults) {
    throw new Error(ScrapErrors.NO_RESULT_FOUND);
  }
}

/**
 * Parse cdiscount result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @returns {object} The parsed datas
 */
async function parseResult(page, phone) {
  console.log('cdiscount parse result');
  // No need to use artoo. Parse result list.
  await page.bringToFront();
  await setLevenshteinFunction(page);
  const phoneSearch = phone.toString({
    withQuotes: false
  });
  var parsedDatas = await page.evaluate((phoneSearch, gradeToCRCondition) => {
    const resultsDOM = document.querySelectorAll('#lpBloc > li');
    var results = [];
    for (var i = 1; i < resultsDOM.length - 1; i++) { // Start to 1, remove last : it's not results, only adds
      const isNew = (resultsDOM[i].querySelector('div.prdtBILDetails > div.prdtBILState > span') == null);
      const isLine = (resultsDOM[i].querySelector('div.nativeAdBloc') != null);

      if (isNew && !isLine) { //Keep only new phones (not second hands)
        const oldPriceDOM = resultsDOM[i].querySelector('span.prdtPrBILSt');
        const vendorLabel = resultsDOM[i].querySelector('div.prdtBILDetails > a > div').innerText.trim();
        // TODO ? Better choice with levenshtein ? *
        // const levenshtein = levenshteinDistance(phoneSearch.toUpperCase(), vendorLabel.toUpperCase());

        var scrapResult = {
          // levenshtein,
          vendorLabel: vendorLabel,
          isPromo: false,
          price: parseFloat(resultsDOM[i].querySelector('span.price').innerText
            .replace('€', '.')
            .trim())
        };
        if (oldPriceDOM) {
          scrapResult.isPromo = true;
          scrapResult.oldPrice = parseFloat(oldPriceDOM.innerText
            .replace('€', '')
            .replace(',', '.')
            .trim());
        }

        results.push(scrapResult);
      }
    }

    return results;
  }, phoneSearch, config.cashandrepair.condition_equivalence);

  if (parsedDatas.length == 0) {
    throw new Error(ScrapErrors.NO_RESULT_FOUND);
  }

  // TODO ? *do not return first result but minimumLevenshtein
  return parsedDatas[0];
}

module.exports = {
  scrap
}
