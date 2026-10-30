// Bundled snapshot of data/spending.json, used if the live file cannot be loaded.
// Written by pipeline/build-spending.mjs; do not edit by hand.
export default {
  "meta": {
    "title": "Public Expenditure Statistical Analyses 2026",
    "url": "https://www.gov.uk/government/statistics/public-expenditure-statistical-analyses-2026",
    "publisher": "HM Treasury",
    "published": "2026-07-16",
    "file": "https://assets.publishing.service.gov.uk/media/6a5772f59e63154454413701/PESA_2026_CP_Chapter_5_tables.xlsx",
    "fileTitle": "PESA 2026 Chapter 5 Tables",
    "table": "Table 5.2 Public sector expenditure on services by sub-function, 2021-22 to 2025-26",
    "fiscalYear": "2025-26",
    "basis": "TES",
    "units": "£ million",
    "tes": 1227648,
    "accountingAdjustments": 132474,
    "tme": 1360122,
    "generated": "2026-10-30T00:30:25.819Z",
    "taxonomyVersion": "1.0.0"
  },
  "categories": [
    {
      "id": "health",
      "name": "Health",
      "description": "The NHS: hospitals, GPs, medicines, public health and medical research.",
      "amount": 257542,
      "children": [
        {
          "id": "medical-services",
          "name": "Hospitals, GPs and other medical services",
          "amount": 247359
        },
        {
          "id": "health-admin",
          "name": "Health administration and public health",
          "amount": 7311
        },
        {
          "id": "medical-research",
          "name": "Medical research",
          "amount": 2871
        }
      ],
      "share": 0.20978488947972057
    },
    {
      "id": "welfare",
      "name": "Welfare",
      "description": "Benefits for people of working age, disabled people and families, including Universal Credit and Child Benefit.",
      "amount": 194894,
      "children": [
        {
          "id": "universal-credit",
          "name": "Universal Credit, tax credits and income support",
          "amount": 84272
        },
        {
          "id": "disability-benefits",
          "name": "Disability and incapacity benefits",
          "amount": 66272
        },
        {
          "id": "family-benefits",
          "name": "Family benefits, such as Child Benefit",
          "amount": 17291
        },
        {
          "id": "housing-support",
          "name": "Help with housing costs, such as Housing Benefit",
          "amount": 14462
        },
        {
          "id": "other-support",
          "name": "Other support, including compensation schemes",
          "description": "Includes compensation paid directly to people, such as for infected blood and the Post Office Horizon scandal.",
          "amount": 11201
        },
        {
          "id": "unemployment-benefits",
          "name": "Unemployment benefits",
          "amount": 1396
        },
        {
          "id": "welfare-research",
          "name": "Research on social protection",
          "amount": 0
        }
      ],
      "share": 0.1587539750808049
    },
    {
      "id": "pensions",
      "name": "Pensions",
      "description": "The State Pension, Pension Credit and other help for pensioners.",
      "amount": 156241,
      "children": [
        {
          "id": "state-pension",
          "name": "State Pension and pensioner benefits",
          "description": "Mostly the State Pension, plus Pension Credit and other pensioner benefits. Public service pensions are counted net of the contributions paid in.",
          "amount": 154858
        },
        {
          "id": "survivors",
          "name": "Benefits for widows and other survivors",
          "amount": 1383
        }
      ],
      "share": 0.12726856558231675
    },
    {
      "id": "debt-interest",
      "name": "Debt interest",
      "description": "Interest on government borrowing, the Bank of England's bond-buying losses, and interest building up in public sector pension schemes.",
      "amount": 130305,
      "children": [
        {
          "id": "central-debt",
          "name": "Interest on central government debt",
          "amount": 96946
        },
        {
          "id": "pension-scheme-interest",
          "name": "Interest building up in public sector pension schemes",
          "description": "An accounting cost, not a cash payment to lenders: the yearly growth in what funded public sector pension schemes, chiefly the Local Government Pension Scheme, owe their members.",
          "amount": 19381
        },
        {
          "id": "bank-of-england",
          "name": "Bank of England bond-buying costs",
          "description": "Losses on the Bank of England's Asset Purchase Facility, which the Treasury covers.",
          "amount": 12344
        },
        {
          "id": "council-debt",
          "name": "Council debt interest",
          "amount": 1132
        },
        {
          "id": "public-corporation-debt",
          "name": "Public corporation debt interest",
          "amount": 502
        }
      ],
      "share": 0.1061419885830466
    },
    {
      "id": "education",
      "name": "Education",
      "description": "Nurseries, schools, colleges and universities.",
      "amount": 125721,
      "children": [
        {
          "id": "secondary",
          "name": "Secondary schools",
          "description": "Includes all academies, primary ones too, because the Department for Education records all academy spending as secondary.",
          "amount": 60842
        },
        {
          "id": "primary",
          "name": "Primary schools",
          "description": "Understated: the Department for Education records all academy spending as secondary.",
          "amount": 33808
        },
        {
          "id": "under-fives",
          "name": "Under-fives",
          "amount": 9621
        },
        {
          "id": "support-services",
          "name": "School meals, transport and other support services",
          "amount": 6960
        },
        {
          "id": "education-other",
          "name": "Other education",
          "amount": 6145
        },
        {
          "id": "higher-education",
          "name": "Universities and other higher education",
          "amount": 4641
        },
        {
          "id": "education-research",
          "name": "Education research",
          "amount": 2626
        },
        {
          "id": "further-education",
          "name": "Further education below degree level",
          "amount": 1078
        }
      ],
      "share": 0.10240801923678448
    },
    {
      "id": "defence",
      "name": "Defence",
      "description": "The armed forces, military aid and defence research.",
      "amount": 65418,
      "children": [
        {
          "id": "armed-forces",
          "name": "Armed forces",
          "amount": 58171
        },
        {
          "id": "military-aid",
          "name": "Military aid to other countries",
          "amount": 3999
        },
        {
          "id": "defence-research",
          "name": "Defence research",
          "amount": 2939
        },
        {
          "id": "defence-other",
          "name": "Other defence",
          "amount": 245
        },
        {
          "id": "civil-defence",
          "name": "Civil defence",
          "amount": 64
        }
      ],
      "share": 0.05328726149515171
    },
    {
      "id": "social-care",
      "name": "Social care",
      "description": "Care for older people, disabled adults and children, run by councils.",
      "amount": 56135,
      "children": [
        {
          "id": "children",
          "name": "Children's social care",
          "amount": 18253
        },
        {
          "id": "disabled-adults",
          "name": "Care for disabled adults",
          "amount": 18059
        },
        {
          "id": "older-people",
          "name": "Care for older people",
          "amount": 17322
        },
        {
          "id": "care-other",
          "name": "Other social care",
          "amount": 2501
        }
      ],
      "share": 0.04572564774267542
    },
    {
      "id": "public-order",
      "name": "Police, courts and prisons",
      "description": "Police, border control, fire and rescue, courts and prisons.",
      "amount": 55720,
      "children": [
        {
          "id": "police",
          "name": "Police",
          "amount": 26776
        },
        {
          "id": "courts",
          "name": "Courts",
          "amount": 10029
        },
        {
          "id": "prisons",
          "name": "Prisons",
          "amount": 8411
        },
        {
          "id": "immigration",
          "name": "Immigration and border control",
          "amount": 4781
        },
        {
          "id": "fire",
          "name": "Fire and rescue",
          "amount": 4166
        },
        {
          "id": "public-order-other",
          "name": "Other, including research",
          "amount": 1557
        }
      ],
      "share": 0.04538760296110937
    },
    {
      "id": "transport",
      "name": "Transport",
      "description": "Railways, roads, buses and other transport.",
      "amount": 48923,
      "children": [
        {
          "id": "railways",
          "name": "Railways",
          "amount": 26479
        },
        {
          "id": "local-roads",
          "name": "Local roads",
          "amount": 8111
        },
        {
          "id": "national-roads",
          "name": "National roads",
          "amount": 6128
        },
        {
          "id": "local-transport",
          "name": "Buses and local public transport",
          "amount": 5552
        },
        {
          "id": "transport-other",
          "name": "Other transport",
          "amount": 2653
        }
      ],
      "share": 0.03985099963507455
    },
    {
      "id": "economy",
      "name": "Business, energy, farming and science",
      "description": "Support for business and jobs, energy, farming, broadband and research.",
      "amount": 45036,
      "children": [
        {
          "id": "business-jobs",
          "name": "Business, trade and employment support",
          "amount": 17878
        },
        {
          "id": "economic-research",
          "name": "Research and development",
          "amount": 11268
        },
        {
          "id": "energy",
          "name": "Energy",
          "amount": 6564
        },
        {
          "id": "farming-policy",
          "name": "Farming, food and fisheries",
          "amount": 3724
        },
        {
          "id": "farm-payments",
          "name": "Farm payments",
          "amount": 2593
        },
        {
          "id": "communications",
          "name": "Broadband and communications",
          "amount": 1195
        },
        {
          "id": "economy-other",
          "name": "Other",
          "amount": 918
        },
        {
          "id": "industry",
          "name": "Mining, manufacturing and construction",
          "amount": 312
        },
        {
          "id": "other-industries",
          "name": "Other industries",
          "amount": 302
        },
        {
          "id": "forestry",
          "name": "Forestry",
          "amount": 281
        }
      ],
      "share": 0.036684782608695655
    },
    {
      "id": "government",
      "name": "Running the government",
      "description": "Parliament, ministries, tax collection, diplomacy and payments to and from EU institutions.",
      "amount": 27845,
      "children": [
        {
          "id": "central-government",
          "name": "Parliament, ministries, tax collection and diplomacy",
          "amount": 19872
        },
        {
          "id": "government-other",
          "name": "Other government services",
          "amount": 5279
        },
        {
          "id": "general-services",
          "name": "General government services",
          "amount": 2350
        },
        {
          "id": "government-research",
          "name": "Government research",
          "amount": 510
        },
        {
          "id": "eu",
          "name": "Net payments to EU institutions",
          "description": "Payments to EU institutions less receipts from them. Negative when receipts are larger.",
          "amount": -166
        }
      ],
      "share": 0.022681582994473985
    },
    {
      "id": "housing",
      "name": "Housing and communities",
      "description": "Council and social housing, local regeneration, street lighting and water.",
      "amount": 22470,
      "children": [
        {
          "id": "council-housing",
          "name": "Council housing",
          "amount": 11991
        },
        {
          "id": "community-development",
          "name": "Community development",
          "amount": 4655
        },
        {
          "id": "social-housing",
          "name": "Other social housing",
          "amount": 2876
        },
        {
          "id": "housing-other",
          "name": "Other, including research",
          "amount": 1340
        },
        {
          "id": "street-lighting",
          "name": "Street lighting",
          "amount": 1075
        },
        {
          "id": "water",
          "name": "Water supply",
          "amount": 534
        }
      ],
      "share": 0.018303292148889583
    },
    {
      "id": "environment",
      "name": "Environment",
      "description": "Rubbish collection and disposal, pollution control and nature.",
      "amount": 19157,
      "children": [
        {
          "id": "waste",
          "name": "Rubbish collection and disposal",
          "amount": 11869
        },
        {
          "id": "environment-other",
          "name": "Other, including waste water",
          "amount": 4002
        },
        {
          "id": "pollution",
          "name": "Pollution control",
          "amount": 2196
        },
        {
          "id": "nature",
          "name": "Wildlife and countryside",
          "amount": 606
        },
        {
          "id": "environment-research",
          "name": "Environmental research",
          "amount": 484
        }
      ],
      "share": 0.015604635856532165
    },
    {
      "id": "culture",
      "name": "Culture, sport and broadcasting",
      "description": "Museums, libraries, the arts, sport and the BBC.",
      "amount": 15053,
      "children": [
        {
          "id": "arts",
          "name": "Museums, libraries and the arts",
          "amount": 5364
        },
        {
          "id": "broadcasting",
          "name": "Broadcasting and publishing",
          "amount": 5312
        },
        {
          "id": "sport",
          "name": "Sport and recreation",
          "amount": 3869
        },
        {
          "id": "culture-other",
          "name": "Other, including research",
          "amount": 364
        },
        {
          "id": "community",
          "name": "Religious and community services",
          "amount": 144
        }
      ],
      "share": 0.012261658064852465
    },
    {
      "id": "aid",
      "name": "Aid to other countries",
      "description": "Economic help to other countries: one part of the overseas aid budget. It is not the official aid (ODA) total, which is measured differently.",
      "amount": 7189,
      "children": [
        {
          "id": "economic-aid",
          "name": "Economic aid to other countries",
          "amount": 7189
        }
      ],
      "share": 0.005855913095610468
    }
  ]
};
