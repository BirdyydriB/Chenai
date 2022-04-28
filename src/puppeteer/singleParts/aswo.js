const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setLevenshteinFunction,
  setArtoo
} = require('./../scraper.js');

const phoneVendorUrl = 'https://shop.aswo.com/aswoShop/startPage.faces?storeId=506';
const phoneVendorDetailedUrl = 'https://aswoshop.aswo.com';

/**
 * Main function to scrap aswo
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('aswo START');
    // Goto aswo, waiting page to be fully loaded
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
    await logToAswo(page);

    await page.waitFor(Math.random() * 500 + 200);
    await search(page, phone);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page);

    console.log('aswo END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To log on aswo
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 */
async function logToAswo(page) {
  console.log('aswo login');
  // Set login
  await page.bringToFront();
  await page.focus('input#startPageHeader\\:startPageForm\\:customer');
  await page.keyboard.type(config.pieces_detachees.aswo.login, {
    delay: 100
  });
  // Set password
  await page.waitFor(Math.random() * 100 + 50);
  await page.bringToFront();
  await page.focus('input#startPageHeader\\:startPageForm\\:secret1');
  await page.keyboard.type(config.pieces_detachees.aswo.password, {
    delay: 100
  });
  // Validate
  await page.waitFor(Math.random() * 100 + 50);
  await page.bringToFront();
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('input#startPageHeader\\:startPageForm\\:login', {
      delay: Math.random() * 200 + 50
    })
  ]);
}

/**
 * Waits until the iframe is attached and then returns it to the caller
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {string} nameOrId - The name or id of the target iframe
 * @returns {object} The Puppeteer iframe element
 */
async function iframeAttached(page, nameOrId) {
  return new Promise(async resolve => {
    const pollingInterval = 300;
    const poll = setInterval(async function waitForIFrameToLoad() {
      const iFrame = page.frames().find(frame => frame.name() === nameOrId);
      if (iFrame) {
        clearInterval(poll);
        resolve(iFrame);
      }
    }, pollingInterval);
  });
}

/**
 * To make search on aswo
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function search(page, phone) {
  // Focus searchField and make user search
  const phoneSearch = phone.toString({
    withQuotes: false,
    withColor: false,
    withCapacity: false
  });
  console.log('aswo search ', phoneSearch);
  await page.bringToFront();
  await page.focus('input#nsearchsuchbg');
  await page.keyboard.type(phoneSearch, {
    delay: 100
  });
  await page.waitFor(Math.random() * 100 + 50);
  await page.bringToFront();
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('input#suchbutton', {
      delay: Math.random() * 200 + 50
    }),
  ]);

  await page.bringToFront();
  const iframe = await iframeAttached(page, 'nsearchiframe');
  // Add levenshtein function and search the phone model
  await iframe.waitForSelector('.modelresultrow', {
    timeout: 0
  });
  await setLevenshteinFunction(iframe);
  await iframe.evaluate(async function(phone, ScrapErrors) {
    var modelsUrl = [];
    var modelUrl;
    const results = document.getElementsByClassName('modelresultrow');
    if (results.length == 0) {
      throw new Error(ScrapErrors.MODEL_NOT_FOUND);
    }

    for (result of results) {
      const firstField = result.querySelector('span.model_results_model')
        .textContent
        .trim()
        .toUpperCase();
      const secondField = result.querySelector('span.model_results_type')
        .textContent
        .trim()
        .toUpperCase();
      const model = firstField + secondField;
      const levenshtein = levenshteinDistance(model, phone._model.toUpperCase());
      if ((model == phone._model.toUpperCase()) || (model == phone._brand.toUpperCase() + ' ' + phone._model.toUpperCase()) ||
        (firstField == phone._model.toUpperCase()) || (firstField == phone._brand.toUpperCase() + ' ' + phone._model.toUpperCase()) ||
        (secondField == phone._model.toUpperCase()) || (secondField == phone._brand.toUpperCase() + ' ' + phone._model.toUpperCase())) {
        // Model founded
        modelUrl = result.querySelector('a.model_results_link');
      }
      // In case we never find the exact same model name
      modelsUrl.push({
        levenshtein: levenshtein,
        model: model,
        modelUrl: result.querySelector('a.model_results_link')
      });
    }

    if (modelUrl) {
      // Exact model founded, return link to single parts
      modelUrl.click();
    } else {
      // Sort to get modelUrl with minimum levenshtein distance, hope this is the searched phone...
      modelsUrl = modelsUrl.sort((modelObject1, modelObject2) => {
        let comparison = 0;
        if (modelObject1.levenshtein > modelObject2.levenshtein) {
          comparison = 1;
        } else if (modelObject1.levenshtein < modelObject2.levenshtein) {
          comparison = -1;
        }
        return comparison;
      });
      // Return single parts URL of the nearest phone founded
      modelsUrl[0].modelUrl.click();
    }
  }, phone, ScrapErrors);
}

/**
 * Parse aswo result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('aswo parseResult');
  const iframe = await iframeAttached(page, 'nsearchiframe');
  await setArtoo(iframe);

  // How many pages of articles ?
  const paginationLastPage = await iframe.evaluate(async function() {
    const paging = $('.paging');
    if (paging.length > 0) {
      return parseFloat($(paging[paging.length - 2]).text());
    }
    else {
      // no pagination, only one page of results
      return 1;
    }
  });
  var parsedDatas = [];

  for (var pagingId = 1; pagingId <= paginationLastPage; pagingId++) {
    if (pagingId > 1) {
      // If not on first articles page, go to next page
      await iframe.evaluate(async function(pagingId) {
        // To check every 1s if page is loaded
        async function getArticlesLoaded(pagingId) {
          return new Promise(async resolve => {
            const poll = setInterval(async () => {
              const currentLoaded = parseFloat($('.pagingactive').text());
              if (currentLoaded == pagingId) {
                clearInterval(poll);
                resolve(true);
              }
            }, 1000);
          });
        }
        // Call aswo function 'getArticles', to get next articles page
        await getArticles(pagingId);
        // Wait until next page is loaded
        await getArticlesLoaded(pagingId);
      }, pagingId);
    }

    // Page loaded : parse it
    await page.bringToFront();
    const pagingParsedDatas = await iframe.evaluate(async function(phoneVendorDetailedUrl) {
      return window.artoo.scrape('.article_results_table > tbody > tr', {
          label: function() {
            return artoo.$(this).find('a.articledetailsbacklink').text().trim();
          },
          href: function() {
            return phoneVendorDetailedUrl + artoo.$(this).find('a.articledetailsbacklink').attr('href');
          },
          price: function() {
            return {
              'net': parseFloat(artoo.$(this).find('.nettoprice')
                .text()
                .trim()
                .slice(2) // Remove starting '€ '
                .replace(',', '.')),
              'PDV Reco': parseFloat(artoo.$(this).find('.bruttoprice')
                .text()
                .trim()
                .slice(2) // Remove starting '€ '
                .replace(',', '.'))
            };
          },
          category: function() {
            return artoo.$(this).find('.article_results_vg_name')
              .text()
              .trim()
              .slice(21); // Remove starting 'Catégorie d'article:'
          },
          available: function() {
            return (artoo.$(this).find('.onstock').length > 0);
          },
          availibility: function() {
            if (artoo.$(this).find('.onstock').length > 0) {
              const stockQuantities = artoo.$(this).find('.stockQuantity');
              return {
                '24h': $(stockQuantities[0]).text().trim(),
                '72h-96h': $(stockQuantities[1]).text().trim()
              };
            }
          }
        })
        .filter(tr => tr.label !== ""); // Remove empty lines
    }, phoneVendorDetailedUrl);

    // Add pages results to all parsed datas
    parsedDatas = parsedDatas.concat(pagingParsedDatas);
  }

  // Sort parsed datas by category
  const normalizedForbidenKeyWords = config.pieces_detachees.aswo.mots_clefs_interdits.map(keyWord => keyWord.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase());
  var singlePartsResult = {};
  for (item of parsedDatas) {
    // Look for forbiden keyWorld
    const itemLabel = item.label.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
    var deletedItem = false;
    for (forbidenKeyWord of normalizedForbidenKeyWords) {
      if (itemLabel.indexOf(forbidenKeyWord) != -1) {
        // Item will be 'deleted'
        if( !singlePartsResult.hasOwnProperty('deletedItem') ) {
          singlePartsResult.deletedItem = [];
        }

        delete item.category; // No need to keep category inside item
        singlePartsResult.deletedItem.push(item);
        deletedItem = true;
      }
    }

    if (!deletedItem) {
      // Transform aswo_category to pieces_detachees_category (if equivalence exists)
      const category = (Object.keys(config.pieces_detachees.aswo.categories_equivalence).indexOf(item.category) == -1) ?
        item.category :
        config.pieces_detachees.aswo.categories_equivalence[item.category];

      if (!singlePartsResult.hasOwnProperty(category)) {
        singlePartsResult[category] = [];
      }

      delete item.category; // No need to keep category inside item
      singlePartsResult[category].push(item);
    }
  };

  return singlePartsResult;
}

module.exports = {
  scrap
}
