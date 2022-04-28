const ScrapErrors = require('./../../errors.js');

const phoneVendorUrl = 'https://www.darty.com';

async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('darty START');
    throw new Error(ScrapErrors.DETECTED_AS_ROBOT);
    // Goto easycash, waiting page to be fully loaded
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
    const parsedDatas = await parseResult(page);

    console.log('darty END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

async function search(page, phone, phoneSearchConstraint) {
  // Focus searchField and make user search
  const phoneSearch = phone.toString(phoneSearchConstraint);
  console.log('darty search ', phoneSearch);
  await page.bringToFront();
  await page.focus('#dartyCom_searchfield_xxl');
  await page.keyboard.type(phoneSearch, {
    delay: 100
  });
  await page.waitFor(Math.random() * 100 + 50);
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('#dartyCom_searchform_submit', {
      delay: Math.random() * 200 + 50
    }),
  ]);
}

async function parseResult(page) {
  var parsedDatas = [{
    condition: 'Bon état',
    price: 612.27
  }];

  return parsedDatas;
}

module.exports = {
  scrap
}
