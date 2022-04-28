const config = require('./../config.json');

/**
 * Apply business rules to scraping results
 *
 * @access public
 * @param {object} scrapingResults - The result of routes.scrapVendors
 * @returns {object} prices - The price(s) after applying all businnes rules (vendor commission, median, price range margin, condition price reduction)
 * @returns {?object} prices.newPrices - Price once business rules applied, for new vendors
 * @returns {?object} prices.secondHandPrices - Prices per condition once business rules applied, for secondHand vendors
 * @returns {?object} prices.categoryPrices - Prices by categories once business rules applied, for single parts vendors
 */
function applyRules(scrapingResults) {
  console.log('applyRules START');
  // Init results
  var returnNew = false, returnSecondHand = false, returnParts = false;
  var newPrices = { prices: [], commissionedPrices: [] };
  var secondHandPrices = {};
  for (grade of Object.keys(config.cashandrepair.decote)) {
    newPrices[grade] = {};
    secondHandPrices[grade] = { prices: [], commissionedPrices: [] };
  }
  var categoryPrices = {};
  var rdmCategoryPrices = {};
  for (category of config.pieces_detachees.categories) {
    categoryPrices[category] = { prices: [], commissionedPrices: [] };
    rdmCategoryPrices[category] = null;
  }

  // Foreach scraping result, get and apply vendor commission
  for (resultKey of Object.keys(scrapingResults)) {
    const vendorType = getVendorType(resultKey);
    if (vendorType && scrapingResults[resultKey] && !scrapingResults[resultKey].error) {
      // Vendor scraping result : apply vendor commission
      const vendorCommission = config[vendorType][resultKey].commission;
      if(vendorType === 'neuf') {
        returnNew = true;
        const commissionedPrice = roundPrice(scrapingResults[resultKey].price / (1 + vendorCommission));
        newPrices.prices.push(scrapingResults[resultKey].price);
        newPrices.commissionedPrices.push(commissionedPrice);
      }
      else if(vendorType === 'occasion') {
        returnSecondHand = true;
        for (priceInfo of scrapingResults[resultKey].prices) {
          const commissionedPrice = roundPrice(priceInfo.price / (1 + vendorCommission));
          if (resultKey != 'rachatdemobile') {
            secondHandPrices[priceInfo.grade].prices.push(priceInfo.price);
            secondHandPrices[priceInfo.grade].commissionedPrices.push(commissionedPrice);
          }
          else {
            priceInfo.commissionedPrice = commissionedPrice;
            rdmCategoryPrices[priceInfo.grade] = priceInfo.commissionedPrice;
          }
        }
      }
      else if(vendorType === 'pieces_detachees') {
        returnParts = true;
        for (singlepartsCategory of Object.keys(scrapingResults[resultKey])) {
          if (Array.isArray(scrapingResults[resultKey][singlepartsCategory])) {
            // Foreach categories
            for (singleParts of scrapingResults[resultKey][singlepartsCategory]) {
              const commissionedPrice = roundPrice(singleParts.price.net / (1 + vendorCommission));
              singleParts.price.commissionedPrice = commissionedPrice;

              if (categoryPrices[singlepartsCategory]) {
                // Only for categories defined in config file
                categoryPrices[singlepartsCategory].prices.push(singleParts.price.net);
                categoryPrices[singlepartsCategory].commissionedPrices.push(commissionedPrice);
              }
            }
          }
        }
      }
    }
  }

  // Get median
  newPrices.median = median(newPrices.commissionedPrices);
  for (grade of Object.keys(secondHandPrices)) {
    secondHandPrices[grade].median = median(secondHandPrices[grade].commissionedPrices);
  }

  // Exclude prices too far from median and recalculate median
  newPrices.medianExcluded = median(excludeDeviationFromMedian(newPrices.commissionedPrices, newPrices.median));
  for (grade of Object.keys(secondHandPrices)) {
    secondHandPrices[grade].medianExcluded = median(excludeDeviationFromMedian(secondHandPrices[grade].commissionedPrices, secondHandPrices[grade].median));
  }

  // Apply margin by price range
  newPrices.priceRangeMargin = priceRangeMargin(newPrices.medianExcluded);
  for (grade of Object.keys(secondHandPrices)) {
    secondHandPrices[grade].priceRangeMargin = priceRangeMargin(secondHandPrices[grade].medianExcluded);
  }

  // Compare secondHandPrice grade A with rachatdemobile newMedianPrice
  if (scrapingResults.rachatdemobile && scrapingResults.rachatdemobile.prices && scrapingResults.rachatdemobile.prices.length > 0) {
    for (grade of Object.keys(secondHandPrices)) {
      if(rdmCategoryPrices[grade]) {
        secondHandPrices[grade].rachatdemobileCompare = parseFloat(((secondHandPrices[grade].priceRangeMargin - rdmCategoryPrices[grade]) / rdmCategoryPrices[grade]).toFixed(4));
      }
    }
  }

  // Apply price reduction by condition (for new vendors)
  var currentConditionPriceRangeMargin = newPrices.priceRangeMargin;
  for (grade of Object.keys(config.cashandrepair.decote)) {
    currentConditionPriceRangeMargin = roundPrice(currentConditionPriceRangeMargin / config.cashandrepair.decote[grade]);
    newPrices[grade] = { "conditionDiscount": currentConditionPriceRangeMargin };
  }

  // Apply businnes rules for single parts categories
  for (category of config.pieces_detachees.categories) {
    categoryPrices[category].median = median(categoryPrices[category].commissionedPrices);
    categoryPrices[category].workshopMargin = roundPrice(categoryPrices[category].median - config.pieces_detachees.marge_atelier * categoryPrices[category].median);
    categoryPrices[category].franchiseMargin = roundPrice(categoryPrices[category].median - config.pieces_detachees.marge_franchise * categoryPrices[category].median);

    for (grade of Object.keys(config.cashandrepair.decote)) {
      // Foreach condition grade, compare workshopMargin and franchiseMargin with new and secondHand prices
      var workshopMarginCompareNew = null, workshopMarginCompareOld = null, franchiseMarginCompareNew = null, franchiseMarginCompareOld = null;
      if (categoryPrices[category].median && newPrices[grade] && newPrices[grade].conditionDiscount) {
        workshopMarginCompareNew = (newPrices[grade].conditionDiscount == categoryPrices[category].workshopMargin) ?
          'equal' :
          ((newPrices[grade].conditionDiscount > categoryPrices[category].workshopMargin) ? 'sup' : 'inf');

        franchiseMarginCompareNew = (newPrices[grade].conditionDiscount == categoryPrices[category].franchiseMargin) ?
          'equal' :
          ((newPrices[grade].conditionDiscount > categoryPrices[category].franchiseMargin) ? 'sup' : 'inf');
      }
      if (categoryPrices[category].median && secondHandPrices[grade] && secondHandPrices[grade].priceRangeMargin) {
        workshopMarginCompareOld = (secondHandPrices[grade].priceRangeMargin == categoryPrices[category].workshopMargin) ?
          'equal' :
          ((secondHandPrices[grade].priceRangeMargin > categoryPrices[category].workshopMargin) ? 'sup' : 'inf');

        franchiseMarginCompareOld = (secondHandPrices[grade].priceRangeMargin == categoryPrices[category].franchiseMargin) ?
          'equal' :
          ((secondHandPrices[grade].priceRangeMargin > categoryPrices[category].franchiseMargin) ? 'sup' : 'inf');
      }

      categoryPrices[category][grade] = {
        'workshopMargin' : {
          'new': workshopMarginCompareNew,
          'secondHand': workshopMarginCompareOld
        },
        'franchiseMargin' : {
          'new': franchiseMarginCompareNew,
          'secondHand': franchiseMarginCompareOld
        }
      }
    }
  }

  console.log('applyRules DONE');
  // Return result (if needed)
  return Object.assign(scrapingResults,
    returnNew ? {newPrices} : null,
    returnSecondHand ? {secondHandPrices} : null,
    returnParts ? {categoryPrices} : null
  );
}

/**
 * Return the vendor type of a vendor (neuf, occasion, pieces_detachees)
 *
 * @access public
 * @param {string} vendorName - The vendor name
 * @returns {string} The vendor type
 */
function getVendorType(vendorName) {
  switch (vendorName) {
    case 'ldlc':
    case 'boulanger':
    case 'cdiscount':
      return 'neuf';
      break;

    case 'easycash':
    case 'backmarket':
    case 'rachatdemobile':
    case 'recommerce':
      return 'occasion';
      break;

    case 'utopya':
    case 'sosav':
    case 'aswo':
    case 'chronospare':
      return 'pieces_detachees';
      break;

    default:
      return false;
      break;
  }
}

/**
 * Rounding a number two digits after the decimal point
 *
 * @access public
 * @param {number} price - Number to round
 * @returns {number} The rounded number
 */
function roundPrice(price) {
  return parseFloat(price.toFixed(2));
}

/**
 * Get median from an array of number
 *
 * @access public
 * @param {Array<number>} arr - Array of number we want the median
 * @returns {number} The median
 */
function median(arr) {
  const mid = Math.floor(arr.length / 2);
  const nums = [...arr].sort((a, b) => a - b);
  return (arr.length % 2 !== 0) ? nums[mid] : roundPrice((nums[mid - 1] + nums[mid]) / 2);
}

/**
 * Remove values from an array if too far from median value of this array
 *
 * @access public
 * @param {Array<number>} arr - Array of number we get the median
 * @param {number} medianValue - The median value of arr
 * @returns {Array<number>} The array given in parameter, without "extreme" values
 */
function excludeDeviationFromMedian(arr, medianValue) {
  var result = [];
  for(price of arr) {
    if((arr.length <= 2) ||
        ((price < medianValue * (config.cashandrepair.ecart_median_max + 1)) &&
        (price > medianValue * (1 - config.cashandrepair.ecart_median_max)))) {
      result.push(price);
    }
  }
  return result;
}

/**
 * Apply marge, based on config.cashandrepair.tranches
 *
 * @access public
 * @param {number} price - The price we want to marged
 * @returns {number} The marged price
 */
function priceRangeMargin(price) {
  for (priceRange of config.cashandrepair.tranches) {
    if ((price >= priceRange.min) && (price < priceRange.max)) {
      return roundPrice(price / priceRange.marge);
    }
  }
  return price;
}

module.exports = {
  applyRules,
  median
}
