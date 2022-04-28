# CHENAÏ

Scraping tool, to get prices from different vendors

## Getting Started

### Prerequisites

-   [Node](https://nodejs.org/fr/)

### Install

```sh
npm ci
```

### Run

Production environment :

```sh
npm start
```

Development environment :

```sh
npm run dev
```

Then, you can send HTTP requests like :
<http://localhost:3000/new/%7B%0A%22marque%22%3A%22Samsung%22%2C%0A%22modele%22%3A%22S10%22%2C%0A%22couleur%22%3A%22rouge%22%2C%0A%22capacite%22%3A%22128Go%22%0A%7D>

## Code architecture

-   **app.js** -- _Entry point of Chenaï. Run Express router and init routes._
-   **config.json** -- _Configuration file. Read below for more details._
-   **_src_**
    -   **_puppeteer_** -- _All the scrapers_
        -   **_new_** -- _Scrapers of the vendors of new_
            -   **boulanger.js**
            -   **cdiscount.js**
            -   **ldlc.js**
        -   **_secondHand_** -- _Scrapers of the second hands vendors_
            -   **backmarket.js**
            -   **easycash.js**
            -   **rachatdemobile.js**
            -   **recommerce.js**
        -   **_singleParts_** -- _Scrapers of the single parts vendors_
            -   **aswo.js**
            -   **chronospare.js**
            -   **sosav.js**
            -   **utopya.js**
        -   **scraper.js** -- _Entry point to scrap a website (retry up to 4*3 times if it can't get a result)_
    -   **businessRules.js** -- _All the business rules to apply after scraping a vendor_
    -   **errors.js** -- _Catched errors texts_
    -   **phone.js** -- _Phone Class_
    -   **routes.js** -- _Webservice routes. It runs all the scrapers, calling scraper.js_

## Requests

scrap vendors of new :
http://localhost:3000/new/:phone

scrap second hands vendors :
http://localhost:3000/old/:phone

scrap single parts vendors :
http://localhost:3000/parts/:phone

scrap all vendors :
http://localhost:3000/all/:phone

scrap a vendor :
http://localhost:3000/vendor/:vendor/:phone

is an item available on sosav :
http://localhost:3000/sosav/available/:url

apply business rules on previously scraped prices :
http://localhost:3000/businessRules/:datas

### Requests - arguments

```json
:phone
{"marque":"<brand>", "modele":"<model>", "couleur":"<color>", "capacite":"<capacity>"}
```

```
:vendor
ldlc | boulanger | cdiscount | easycash | backmarket | rachatdemobile | recommerce | utopya | sosav | aswo | chronospare
```

```
:url
previous href of a phone part
```

```
:datas
previous resquest return : see below (*1), (*2), (*4)
```

### Requests - returns

```json
{
  "phoneSearch":"string <phone brand> <phone model> <phone color> <phone capacity>",
  "date":"date <request date>",
  "<vendorName>":{ (*1)
    "vendorLabel":"string <the title/label of the phone selected on the vendor's website>",
    "isPromo":"boolean <true if Chenaï detect any promotion>",            
    "price":"float <the sale price of the phone>",
    "oldPrice":"float <only if 'isPromo' and is detected, the sale price of the phone before promotion>",
    "available":"boolean <only LDLC, true if phone is 'En stock'>",
    "availability":"string <only LDLC, text below 'Disponibilité site:'>",
    "try":"int <number of attempts (changing search), to get the phone on the vendor's website>"
  },
  "<vendorName>":{ (*2)
    "vendorLabel":"string <the title/label of the phone selected on the vendor's website>",
    "prices":[{ (*3)
      "condition":"string <phone condition according to the vendor's scale>",
      "isPromo":"boolean <true if Chenaï detect any promotion>",            
      "price":"float <the sale price of the phone>",
      "prices":"array of float <only RACHATDEMOBILE, all 'comme neuf' prices>",
      "oldPrice": "float <only if 'isPromo' and is detected, the sale price of the phone before promotion>",
      "grade":"A|B|C... <vendor.condition_equivalence of 'condition'>",
      "CRCondition":"string <cashandrepair.condition_equivalence of 'grade'>"
    }],
    "try":"int <number of attempts (changing search), to get the phone on the vendor's website>"
  },   
  "<vendorName>":{ (*4)
    "<categoryName>": [{ (*5)
      "label":"string <the title/label of the phone part on the vendor's website>",            
      "href":"string <a link to the vendor's detailed page of the phone part>",
      "price": {
        "net":"float <the sale price of the phone part>",
        "commissionedPrice": "float <the phone part price after vendor commission taken>",
        "PDV Reco":"float <only ASWO, the recommended sale price of the phone part>"
      },          
      "available":"boolean <except SOSAV, is this phone part available ?>",
      "availibility": {
        "24h":"string <only ASWO, number of parts available under 24h>",
        "72h-96h":"string <only ASWO, number of parts available under 72h-96h>"
      },
      "availibility": "string <only CHRONOSPARE, number of parts available>"          
    }],
    "try":"int <number of attempts (changing search), to get the phone parts on the vendor's website>",
    "median":"float <the median price of the category>",
    "workshopMargin":"float <the median price of the category, minus workshop margin>",
    "franchiseMargin":"float <the median price of the category, minus workshop margin>"
  },
  "<vendorName>":{ (*6)
    "error":"string <the catched error message>",
    "try":"int <number of attempts (changing search), to get the phone/parts on the vendor's website>"
  },
  "newPrices":{ (*7)
    "prices":["array of float <the phone prices obtained on all the new phone vendors>"],
    "commissionedPrices":["array of float <the phone prices after vendors commission taken>"],
    "median":"float <the phone price median value>",
    "medianExcluded":"float <the new phone price median value, after removing prices too far from median>",
    "priceRangeMargin":"float <the median phone price, after price range margin applied>",
    "<A|B|C...>":{
      "conditionDiscount":"float <the final phone price, for a given condition>"
    }
  },
  "secondHandPrices":{ (*8)
    "<A|B|C...>":{
      "prices":["array of float <the phone prices obtained on all the second hand phone vendors, for a given condition>"],
      "commissionedPrices":["array of float <the phone prices after vendors commission taken>"],
      "median":"float <the phone price median value>",
      "medianExcluded":"float <the new phone price median value, after removing prices too far from median>",
      "priceRangeMargin":"float <the median phone price, after price range margin applied>",
      "rachatdemobileCompare":"float <only if RACHATDEMOBILE scraped, compare priceRangeMargin for this grade and rachat de mobile price for this same grade>"
    },
  },
  "categoryPrices":{ (*9)
    "<categoryName>":{
      "prices":["array of float <the parts prices of this category>"],
      "commissionedPrices":["array of float <the parts prices after vendors commission taken>"],
      "median":"float <the median category price>",
      "workshopMargin":"float <the median category price, after workshop margin applied>",
      "franchiseMargin":"float <the median category price, after franchise margin applied>",
      "actionRecommandation": {
          "<A|B|C...>":{
            "workshopMargin": {
              "new":"string <sup|inf|equal, comparison of new phone condition discount price, grade A|B|C..., with this category workshop margin price>",
              "secondHand":"string <sup|inf|equal, comparison of second hand phone price range margin, grade A|B|C..., with this category workshop margin price>"
            },
            "franchiseMargin": {
              "new":"string <sup|inf|equal, comparison of new phone condition discount price, grade A|B|C..., with this category franchise margin price>",
              "secondHand":"string <sup|inf|equal, comparison of second hand phone price range margin, grade A|B|C..., with this category franchise margin price>"
            }
          }
      }
    }
  }
}

// Scraping
(*1) : new phone vendors
(*2) : second hand phone vendors
(*3) : - foreach available condition and if condition_equivalence != ''
(*4) : single parts vendors
(*5) : - foreach single parts categories, array of items
(*6) : if the scraping didn't go well
// Business Rules
(*7) : only if there is new phone vendors scraped
(*8) : only if there is second hand phone vendors scraped
(*9) : only if there is single parts phone vendors scraped
```

Is an item available on sosav :
```json
{
  "available":[{ (*1)
    "color":"string <color name or 'none' if not relevant>",
    "availability":"string <Sosav text after 'Disponibilité :'>"
  }]
}

(*1) : foreach founded colors
```

## Config

```json
{
  "temps_max_par_site":"int <maximum time (in seconds), in 1 attempt to scrap a vendor, before a timeout is raised>",
  "nb_tentatives_max_par_site":"int <maximum number of retry with same search, when scraping raise an error>",

  "cashandrepair":{
    "ecart_median_max":"float <btw 0 and 1 ; maximum percent deviation from the median before rejecting the price>",
    "condition_equivalence":{
      "A":"Très bon état <Cash and Repair label for grade A condition>",
      "B":"Bon état <Cash and Repair label for grade B condition>",
      "C":"Etat moyen <Cash and Repair label for grade C condition>",
      "...":"<could add or remove grades conditions>"
    },
    "decote":{
      "A":"float <only new vendors, phone price after price range margin, divide by this number, give grade A condition discount phone price>",
      "B":"float <only new vendors, grade A condition discount phone price, divide by this number, give grade B condition discount phone price>",
      "C":"float <only new vendors, grade B condition discount phone price, divide by this number, give grade C condition discount phone price>",
      "...":"<could add or remove grades conditions, same logic>"
    },
    "tranches":[{
        "min":"float <if median price higher than this number>",
        "max":"float <and lower than this number>",
        "marge":"float <divide median price by this number give price range margin price>"
      },
      {"...":"<could add or remove ranges, same logic>"}
    ]
  },

  "neuf":{
    "<newVendorName>":{
      "commission":"float <phone price - phone price * this number, give commissioned price>"
    }
  },

  "occasion":{
    "<secondHandVendorName>":{
      "condition_equivalence":{
        "string <condition label on vendor's website>":"<A|B|C... condition grade>",
        "...":"<if condition grade empty will be removed from result ; could have multiple vendor's condition for a same condition grade>"
      },
      "commission":"float <phone price - phone price * this number, give commissioned price>"
    }
  },

  "pieces_detachees":{
    "categories":["array of string <the differents single parts categories>"],
    "marge_atelier": "float <category median price - category median price * this number, give workshop price>",
    "marge_franchise": "float <category median price - category median price * this number, give franchise price>",

    "<singlePartsVendorName>":{
      "commission":"float <part price - part price * this number, give commissioned price>",
      "login":"string <for UTOPYA, ASWO & CHRONOSPARE>",
      "password":"string <for UTOPYA, ASWO & CHRONOSPARE>",
      "mots_clefs_interdits":["array of string <if found one of this words into part phone label, add item in deletedItem category>"],
      "mots_clefs_categories":{
        "string <if found this word into part phone label>":"string <add item in this category>"
      },
      "categories_equivalence":{
        "ASWO category name":"Cash and Repair category name"
      }
    }
  }
}
```

## Built With

-   [express](https://expressjs.com/fr/) - The web framework used
-   [puppeteer](https://github.com/puppeteer/puppeteer) - Headless Chromium API
-   [artoo](https://medialab.github.io/artoo/) - Scraping utilities

## Author

-   **Anthony Loizeau** - a.loizeau@gc.fr - _Initial work_
