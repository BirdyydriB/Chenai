const ScrapErrors = require('./../../errors.js');

async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('fnac START');
    throw new Error(ScrapErrors.DETECTED_AS_ROBOT);
    // Goto easycash, waiting page to be fully loaded
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto('https://www.fnac.com/', {
        timeout: 0
      })
    ]);

    var parsedDatas = [{
      condition: 'Très bon état',
      price: 123.45
    }];
    console.log('fnac END');
    return parsedDatas[0];

  } catch (err) {
    return {
      error: err.message
    };
  }
}

module.exports = {
  scrap
}