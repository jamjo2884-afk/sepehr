// AUTO-GENERATED from "Copy of گزارش ماهیانه سپهر - Data.csv".
// 12 brands across 8 social platforms, monthly follower snapshots
// (Jalali months YYYY-MM) from 1403-04 to 1405-03. Do not edit by hand.
export interface SocialMonthlyPoint { month: string; value: number; }
export interface SocialAccountSeries { handle: string | null; series: SocialMonthlyPoint[]; }
export interface SocialBrandPlatform { [handleKey: string]: SocialAccountSeries; }
export interface SocialBrandNode {
  name: string;
  platforms: Partial<Record<string, SocialBrandPlatform>>;
}
export const socialBrandData: SocialBrandNode[] = [
  {
    "name": "کبریت",
    "platforms": {
      "instagram": {
        "kebritmedia.ir": {
          "handle": "kebritmedia.ir",
          "series": [
            {
              "month": "1403-04",
              "value": 227048
            },
            {
              "month": "1403-05",
              "value": 229050
            },
            {
              "month": "1403-06",
              "value": 230123
            },
            {
              "month": "1403-07",
              "value": 231100
            },
            {
              "month": "1403-08",
              "value": 234000
            },
            {
              "month": "1403-09",
              "value": 239000
            },
            {
              "month": "1403-10",
              "value": 252000
            },
            {
              "month": "1403-11",
              "value": 256000
            },
            {
              "month": "1403-12",
              "value": 258000
            },
            {
              "month": "1404-01",
              "value": 269000
            },
            {
              "month": "1404-02",
              "value": 274000
            },
            {
              "month": "1404-03",
              "value": 282000
            },
            {
              "month": "1404-04",
              "value": 285000
            },
            {
              "month": "1404-05",
              "value": 294000
            },
            {
              "month": "1404-06",
              "value": 297000
            },
            {
              "month": "1404-07",
              "value": 325000
            },
            {
              "month": "1404-08",
              "value": 339000
            },
            {
              "month": "1404-09",
              "value": 347000
            },
            {
              "month": "1404-10",
              "value": 356000
            },
            {
              "month": "1404-11",
              "value": 360000
            },
            {
              "month": "1404-12",
              "value": 362000
            },
            {
              "month": "1405-01",
              "value": 362000
            },
            {
              "month": "1405-02",
              "value": 360000
            },
            {
              "month": "1405-03",
              "value": 369000
            }
          ]
        },
        "kebritschool": {
          "handle": "kebritschool",
          "series": [
            {
              "month": "1403-05",
              "value": 9653
            },
            {
              "month": "1403-06",
              "value": 9625
            },
            {
              "month": "1403-07",
              "value": 9600
            },
            {
              "month": "1403-08",
              "value": 9600
            },
            {
              "month": "1403-09",
              "value": 9500
            },
            {
              "month": "1403-10",
              "value": 9450
            },
            {
              "month": "1403-11",
              "value": 9408
            },
            {
              "month": "1403-12",
              "value": 9380
            },
            {
              "month": "1404-01",
              "value": 9326
            },
            {
              "month": "1404-02",
              "value": 9287
            },
            {
              "month": "1404-03",
              "value": 9246
            },
            {
              "month": "1404-04",
              "value": 9315
            },
            {
              "month": "1404-05",
              "value": 9285
            },
            {
              "month": "1404-06",
              "value": 9285
            },
            {
              "month": "1404-07",
              "value": 9183
            },
            {
              "month": "1404-08",
              "value": 9125
            },
            {
              "month": "1404-09",
              "value": 9088
            },
            {
              "month": "1404-10",
              "value": 18000
            },
            {
              "month": "1404-11",
              "value": 10000
            },
            {
              "month": "1404-12",
              "value": 8995
            },
            {
              "month": "1405-01",
              "value": 8995
            },
            {
              "month": "1405-02",
              "value": 8976
            },
            {
              "month": "1405-03",
              "value": 8890
            }
          ]
        },
        "mardomakmedia": {
          "handle": "mardomakmedia",
          "series": [
            {
              "month": "1403-09",
              "value": 265
            }
          ]
        },
        "soalpich1": {
          "handle": "soalpich1",
          "series": [
            {
              "month": "1403-09",
              "value": 99
            }
          ]
        },
        "kebritout": {
          "handle": "kebritout",
          "series": [
            {
              "month": "1403-09",
              "value": 2361
            }
          ]
        },
        "MARDOMAKMEDIA": {
          "handle": "MARDOMAKMEDIA",
          "series": [
            {
              "month": "1405-02",
              "value": 16900
            }
          ]
        }
      },
      "twitter": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 1873
            },
            {
              "month": "1403-05",
              "value": 1863
            },
            {
              "month": "1403-06",
              "value": 1848
            },
            {
              "month": "1403-08",
              "value": 1800
            },
            {
              "month": "1403-09",
              "value": 1800
            },
            {
              "month": "1403-10",
              "value": 1800
            },
            {
              "month": "1403-11",
              "value": 1800
            },
            {
              "month": "1403-12",
              "value": 0
            },
            {
              "month": "1404-01",
              "value": 0
            },
            {
              "month": "1404-02",
              "value": 1800
            },
            {
              "month": "1404-03",
              "value": 1800
            },
            {
              "month": "1404-04",
              "value": 1800
            },
            {
              "month": "1404-05",
              "value": 1800
            },
            {
              "month": "1404-06",
              "value": 1800
            },
            {
              "month": "1404-07",
              "value": 1800
            },
            {
              "month": "1404-08",
              "value": 1800
            },
            {
              "month": "1404-09",
              "value": 1800
            },
            {
              "month": "1404-12",
              "value": 1719
            }
          ]
        }
      },
      "telegram": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 20712
            },
            {
              "month": "1403-05",
              "value": 20486
            },
            {
              "month": "1403-06",
              "value": 20251
            },
            {
              "month": "1403-07",
              "value": 20026
            },
            {
              "month": "1403-08",
              "value": 19814
            },
            {
              "month": "1403-09",
              "value": 19814
            },
            {
              "month": "1403-10",
              "value": 19700
            },
            {
              "month": "1403-11",
              "value": 19542
            },
            {
              "month": "1403-12",
              "value": 19394
            },
            {
              "month": "1404-01",
              "value": 19252
            },
            {
              "month": "1404-02",
              "value": 19084
            },
            {
              "month": "1404-03",
              "value": 18896
            },
            {
              "month": "1404-04",
              "value": 18695
            },
            {
              "month": "1404-05",
              "value": 18539
            },
            {
              "month": "1404-06",
              "value": 18464
            },
            {
              "month": "1404-07",
              "value": 18321
            },
            {
              "month": "1404-08",
              "value": 18232
            },
            {
              "month": "1404-09",
              "value": 18129
            },
            {
              "month": "1404-10",
              "value": 9051
            },
            {
              "month": "1404-11",
              "value": 17866
            },
            {
              "month": "1404-12",
              "value": 17790
            },
            {
              "month": "1405-01",
              "value": 17700
            },
            {
              "month": "1405-02",
              "value": 17700
            },
            {
              "month": "1405-03",
              "value": 17500
            }
          ]
        }
      },
      "youtube": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 7460
            },
            {
              "month": "1403-05",
              "value": 7520
            },
            {
              "month": "1403-06",
              "value": 7910
            },
            {
              "month": "1403-07",
              "value": 8100
            },
            {
              "month": "1403-08",
              "value": 8400
            },
            {
              "month": "1403-09",
              "value": 8400
            },
            {
              "month": "1403-10",
              "value": 11000
            },
            {
              "month": "1403-11",
              "value": 12100
            },
            {
              "month": "1403-12",
              "value": 12400
            },
            {
              "month": "1404-01",
              "value": 12900
            },
            {
              "month": "1404-02",
              "value": 13100
            },
            {
              "month": "1404-03",
              "value": 13400
            },
            {
              "month": "1404-04",
              "value": 13500
            },
            {
              "month": "1404-05",
              "value": 13700
            },
            {
              "month": "1404-06",
              "value": 13900
            },
            {
              "month": "1404-07",
              "value": 14200
            },
            {
              "month": "1404-08",
              "value": 14300
            },
            {
              "month": "1404-09",
              "value": 14400
            },
            {
              "month": "1404-10",
              "value": 14600
            },
            {
              "month": "1404-11",
              "value": 100
            },
            {
              "month": "1404-12",
              "value": 100
            },
            {
              "month": "1405-01",
              "value": 100
            },
            {
              "month": "1405-02",
              "value": 100
            },
            {
              "month": "1405-03",
              "value": 237
            }
          ]
        }
      },
      "eita": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 6000
            },
            {
              "month": "1403-05",
              "value": 6000
            },
            {
              "month": "1403-06",
              "value": 6000
            },
            {
              "month": "1403-07",
              "value": 6100
            },
            {
              "month": "1403-08",
              "value": 6200
            },
            {
              "month": "1403-09",
              "value": 6500
            },
            {
              "month": "1403-10",
              "value": 6600
            },
            {
              "month": "1403-11",
              "value": 6593
            },
            {
              "month": "1403-12",
              "value": 6600
            },
            {
              "month": "1404-01",
              "value": 6644
            },
            {
              "month": "1404-02",
              "value": 6637
            },
            {
              "month": "1404-03",
              "value": 7000
            },
            {
              "month": "1404-04",
              "value": 7126
            },
            {
              "month": "1404-05",
              "value": 7206
            },
            {
              "month": "1404-06",
              "value": 7215
            },
            {
              "month": "1404-07",
              "value": 7300
            },
            {
              "month": "1404-08",
              "value": 7400
            },
            {
              "month": "1404-09",
              "value": 7400
            },
            {
              "month": "1404-10",
              "value": 7600
            },
            {
              "month": "1404-11",
              "value": 8000
            },
            {
              "month": "1404-12",
              "value": 8800
            },
            {
              "month": "1405-01",
              "value": 9600
            },
            {
              "month": "1405-02",
              "value": 10000
            },
            {
              "month": "1405-03",
              "value": 10500
            }
          ]
        }
      },
      "bale": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 4600
            },
            {
              "month": "1403-05",
              "value": 4600
            },
            {
              "month": "1403-06",
              "value": 4700
            },
            {
              "month": "1403-07",
              "value": 4800
            },
            {
              "month": "1403-08",
              "value": 5200
            },
            {
              "month": "1403-09",
              "value": 5200
            },
            {
              "month": "1403-10",
              "value": 5200
            },
            {
              "month": "1403-11",
              "value": 5200
            },
            {
              "month": "1403-12",
              "value": 5300
            },
            {
              "month": "1404-01",
              "value": 5500
            },
            {
              "month": "1404-02",
              "value": 6100
            },
            {
              "month": "1404-03",
              "value": 7100
            },
            {
              "month": "1404-04",
              "value": 7400
            },
            {
              "month": "1404-05",
              "value": 7700
            },
            {
              "month": "1404-06",
              "value": 7572
            },
            {
              "month": "1404-07",
              "value": 8300
            },
            {
              "month": "1404-08",
              "value": 8500
            },
            {
              "month": "1404-09",
              "value": 8800
            },
            {
              "month": "1404-10",
              "value": 10200
            },
            {
              "month": "1404-11",
              "value": 12200
            },
            {
              "month": "1404-12",
              "value": 28800
            },
            {
              "month": "1405-01",
              "value": 29600
            },
            {
              "month": "1405-02",
              "value": 29800
            },
            {
              "month": "1405-03",
              "value": 30500
            }
          ]
        }
      },
      "soroushplus": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 4600
            },
            {
              "month": "1403-05",
              "value": 4600
            },
            {
              "month": "1403-06",
              "value": 4600
            },
            {
              "month": "1403-07",
              "value": 4500
            },
            {
              "month": "1403-08",
              "value": 4500
            },
            {
              "month": "1403-09",
              "value": 4500
            },
            {
              "month": "1403-10",
              "value": 4500
            },
            {
              "month": "1403-11",
              "value": 4500
            },
            {
              "month": "1403-12",
              "value": 4500
            },
            {
              "month": "1404-01",
              "value": 4500
            },
            {
              "month": "1404-02",
              "value": 4500
            },
            {
              "month": "1404-03",
              "value": 4500
            },
            {
              "month": "1404-04",
              "value": 4500
            },
            {
              "month": "1404-05",
              "value": 4500
            },
            {
              "month": "1404-06",
              "value": 4550
            },
            {
              "month": "1404-07",
              "value": 4550
            },
            {
              "month": "1404-08",
              "value": 4500
            },
            {
              "month": "1404-09",
              "value": 4500
            },
            {
              "month": "1404-10",
              "value": 2300
            },
            {
              "month": "1404-11",
              "value": 23000
            },
            {
              "month": "1404-12",
              "value": 98200
            },
            {
              "month": "1405-01",
              "value": 97800
            },
            {
              "month": "1405-02",
              "value": 85600
            },
            {
              "month": "1405-03",
              "value": 81600
            }
          ]
        }
      },
      "rubika": {
        "kebritmedia": {
          "handle": "kebritmedia",
          "series": [
            {
              "month": "1403-07",
              "value": 135
            },
            {
              "month": "1403-08",
              "value": 138
            },
            {
              "month": "1403-09",
              "value": 147
            },
            {
              "month": "1403-10",
              "value": 152
            },
            {
              "month": "1403-11",
              "value": 152
            },
            {
              "month": "1403-12",
              "value": 157
            },
            {
              "month": "1404-01",
              "value": 162
            },
            {
              "month": "1404-02",
              "value": 152
            },
            {
              "month": "1404-03",
              "value": 152
            },
            {
              "month": "1404-04",
              "value": 152
            },
            {
              "month": "1404-05",
              "value": 152
            },
            {
              "month": "1404-06",
              "value": 152
            },
            {
              "month": "1404-07",
              "value": 152
            },
            {
              "month": "1404-08",
              "value": 152
            },
            {
              "month": "1404-09",
              "value": 152
            },
            {
              "month": "1404-10",
              "value": 10200
            },
            {
              "month": "1404-11",
              "value": 13600
            },
            {
              "month": "1404-12",
              "value": 85900
            },
            {
              "month": "1405-01",
              "value": 68700
            },
            {
              "month": "1405-02",
              "value": 61600
            },
            {
              "month": "1405-03",
              "value": 56300
            }
          ]
        }
      }
    }
  },
  {
    "name": "ازما",
    "platforms": {
      "instagram": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 16400
            },
            {
              "month": "1403-05",
              "value": 16400
            },
            {
              "month": "1403-06",
              "value": 16400
            },
            {
              "month": "1403-07",
              "value": 16391
            },
            {
              "month": "1403-08",
              "value": 16433
            },
            {
              "month": "1403-09",
              "value": 16431
            },
            {
              "month": "1403-10",
              "value": 16372
            },
            {
              "month": "1403-11",
              "value": 16320
            },
            {
              "month": "1403-12",
              "value": 16290
            },
            {
              "month": "1404-01",
              "value": 16229
            },
            {
              "month": "1404-02",
              "value": 16183
            },
            {
              "month": "1404-03",
              "value": 16177
            },
            {
              "month": "1404-04",
              "value": 16201
            },
            {
              "month": "1404-05",
              "value": 16154
            },
            {
              "month": "1404-06",
              "value": 16126
            },
            {
              "month": "1404-07",
              "value": 16110
            },
            {
              "month": "1404-08",
              "value": 23384
            },
            {
              "month": "1404-09",
              "value": 27350
            },
            {
              "month": "1404-10",
              "value": 28333
            },
            {
              "month": "1404-11",
              "value": 31480
            },
            {
              "month": "1404-12",
              "value": 31395
            },
            {
              "month": "1405-01",
              "value": 31386
            },
            {
              "month": "1405-02",
              "value": 31319
            },
            {
              "month": "1405-03",
              "value": 31080
            }
          ]
        },
        "azmaa_news": {
          "handle": "azmaa_news",
          "series": [
            {
              "month": "1403-04",
              "value": 3813
            },
            {
              "month": "1403-05",
              "value": 3843
            },
            {
              "month": "1403-06",
              "value": 3892
            },
            {
              "month": "1403-07",
              "value": 4167
            },
            {
              "month": "1403-08",
              "value": 4274
            },
            {
              "month": "1403-09",
              "value": 4607
            },
            {
              "month": "1403-10",
              "value": 4725
            },
            {
              "month": "1403-11",
              "value": 4892
            },
            {
              "month": "1403-12",
              "value": 5090
            },
            {
              "month": "1404-01",
              "value": 5380
            },
            {
              "month": "1404-02",
              "value": 5590
            },
            {
              "month": "1404-03",
              "value": 5841
            },
            {
              "month": "1404-04",
              "value": 6060
            },
            {
              "month": "1404-05",
              "value": 6201
            },
            {
              "month": "1404-06",
              "value": 6333
            },
            {
              "month": "1404-07",
              "value": 6538
            },
            {
              "month": "1404-08",
              "value": 13547
            },
            {
              "month": "1404-09",
              "value": 17750
            },
            {
              "month": "1404-10",
              "value": 19012
            },
            {
              "month": "1404-11",
              "value": 24039
            },
            {
              "month": "1404-12",
              "value": 21130
            },
            {
              "month": "1405-01",
              "value": 24183
            },
            {
              "month": "1405-02",
              "value": 24176
            },
            {
              "month": "1405-03",
              "value": 24084
            }
          ]
        }
      },
      "youtube": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 236
            },
            {
              "month": "1403-05",
              "value": 238
            },
            {
              "month": "1403-06",
              "value": 246
            },
            {
              "month": "1403-08",
              "value": 0
            },
            {
              "month": "1403-09",
              "value": 0
            },
            {
              "month": "1404-04",
              "value": 0
            },
            {
              "month": "1404-05",
              "value": 0
            },
            {
              "month": "1404-06",
              "value": 0
            },
            {
              "month": "1404-07",
              "value": 0
            },
            {
              "month": "1404-08",
              "value": 0
            },
            {
              "month": "1404-09",
              "value": 0
            },
            {
              "month": "1404-10",
              "value": 0
            },
            {
              "month": "1404-11",
              "value": 0
            },
            {
              "month": "1404-12",
              "value": 0
            },
            {
              "month": "1405-03",
              "value": 0
            }
          ]
        }
      },
      "twitter": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 4174
            },
            {
              "month": "1403-05",
              "value": 4180
            },
            {
              "month": "1403-06",
              "value": 4191
            },
            {
              "month": "1403-07",
              "value": 3978
            },
            {
              "month": "1403-08",
              "value": 4114
            },
            {
              "month": "1403-09",
              "value": 4275
            },
            {
              "month": "1403-10",
              "value": 4308
            },
            {
              "month": "1403-11",
              "value": 4340
            },
            {
              "month": "1403-12",
              "value": 4364
            },
            {
              "month": "1404-01",
              "value": 4385
            },
            {
              "month": "1404-02",
              "value": 4370
            },
            {
              "month": "1404-03",
              "value": 4367
            },
            {
              "month": "1404-04",
              "value": 4348
            },
            {
              "month": "1404-05",
              "value": 4352
            },
            {
              "month": "1404-06",
              "value": 4483
            },
            {
              "month": "1404-07",
              "value": 4508
            },
            {
              "month": "1404-08",
              "value": 4527
            },
            {
              "month": "1404-09",
              "value": 4518
            },
            {
              "month": "1404-10",
              "value": 4527
            },
            {
              "month": "1404-11",
              "value": 4558
            },
            {
              "month": "1404-12",
              "value": 4534
            },
            {
              "month": "1405-01",
              "value": 4503
            },
            {
              "month": "1405-02",
              "value": 4487
            },
            {
              "month": "1405-03",
              "value": 4471
            }
          ]
        }
      },
      "telegram": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 3090
            },
            {
              "month": "1403-05",
              "value": 3093
            },
            {
              "month": "1403-06",
              "value": 3181
            },
            {
              "month": "1403-07",
              "value": 3183
            },
            {
              "month": "1403-08",
              "value": 3239
            },
            {
              "month": "1403-09",
              "value": 3277
            },
            {
              "month": "1403-10",
              "value": 3282
            },
            {
              "month": "1403-11",
              "value": 3278
            },
            {
              "month": "1403-12",
              "value": 3270
            },
            {
              "month": "1404-01",
              "value": 3235
            },
            {
              "month": "1404-02",
              "value": 3182
            },
            {
              "month": "1404-03",
              "value": 3179
            },
            {
              "month": "1404-04",
              "value": 3158
            },
            {
              "month": "1404-05",
              "value": 3126
            },
            {
              "month": "1404-06",
              "value": 3115
            },
            {
              "month": "1404-07",
              "value": 3116
            },
            {
              "month": "1404-08",
              "value": 3139
            },
            {
              "month": "1404-09",
              "value": 3117
            },
            {
              "month": "1404-10",
              "value": 3093
            },
            {
              "month": "1404-11",
              "value": 3066
            },
            {
              "month": "1404-12",
              "value": 3031
            },
            {
              "month": "1405-01",
              "value": 3047
            },
            {
              "month": "1405-02",
              "value": 3044
            },
            {
              "month": "1405-03",
              "value": 3009
            }
          ]
        }
      },
      "eita": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 1900
            },
            {
              "month": "1403-05",
              "value": 1900
            },
            {
              "month": "1403-06",
              "value": 2000
            },
            {
              "month": "1403-07",
              "value": 1981
            },
            {
              "month": "1403-08",
              "value": 2002
            },
            {
              "month": "1403-09",
              "value": 2049
            },
            {
              "month": "1403-10",
              "value": 2011
            },
            {
              "month": "1403-11",
              "value": 1997
            },
            {
              "month": "1403-12",
              "value": 1988
            },
            {
              "month": "1404-01",
              "value": 1965
            },
            {
              "month": "1404-02",
              "value": 1961
            },
            {
              "month": "1404-03",
              "value": 1982
            },
            {
              "month": "1404-04",
              "value": 1960
            },
            {
              "month": "1404-05",
              "value": 1996
            },
            {
              "month": "1404-06",
              "value": 1996
            },
            {
              "month": "1404-07",
              "value": 2039
            },
            {
              "month": "1404-08",
              "value": 2015
            },
            {
              "month": "1404-09",
              "value": 1992
            },
            {
              "month": "1404-10",
              "value": 1994
            },
            {
              "month": "1404-11",
              "value": 2001
            },
            {
              "month": "1404-12",
              "value": 2050
            },
            {
              "month": "1405-01",
              "value": 2218
            },
            {
              "month": "1405-02",
              "value": 2223
            },
            {
              "month": "1405-03",
              "value": 2172
            }
          ]
        }
      },
      "bale": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 1400
            },
            {
              "month": "1403-05",
              "value": 1400
            },
            {
              "month": "1403-06",
              "value": 1352
            },
            {
              "month": "1403-07",
              "value": 1347
            },
            {
              "month": "1403-08",
              "value": 1351
            },
            {
              "month": "1403-09",
              "value": 1359
            },
            {
              "month": "1403-10",
              "value": 1359
            },
            {
              "month": "1403-11",
              "value": 1352
            },
            {
              "month": "1403-12",
              "value": 1348
            },
            {
              "month": "1404-01",
              "value": 1340
            },
            {
              "month": "1404-02",
              "value": 1326
            },
            {
              "month": "1404-03",
              "value": 1319
            },
            {
              "month": "1404-04",
              "value": 1297
            },
            {
              "month": "1404-05",
              "value": 1287
            },
            {
              "month": "1404-06",
              "value": 1280
            },
            {
              "month": "1404-07",
              "value": 1275
            },
            {
              "month": "1404-08",
              "value": 1279
            },
            {
              "month": "1404-09",
              "value": 1268
            },
            {
              "month": "1404-10",
              "value": 1598
            },
            {
              "month": "1404-11",
              "value": 1587
            },
            {
              "month": "1404-12",
              "value": 1587
            },
            {
              "month": "1405-01",
              "value": 1795
            },
            {
              "month": "1405-02",
              "value": 1746
            },
            {
              "month": "1405-03",
              "value": 1689
            }
          ]
        }
      },
      "rubika": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 9919
            },
            {
              "month": "1403-05",
              "value": 9311
            },
            {
              "month": "1403-06",
              "value": 8644
            },
            {
              "month": "1403-07",
              "value": 8264
            },
            {
              "month": "1403-08",
              "value": 7947
            },
            {
              "month": "1403-09",
              "value": 7670
            },
            {
              "month": "1403-10",
              "value": 7389
            },
            {
              "month": "1403-11",
              "value": 7210
            },
            {
              "month": "1403-12",
              "value": 7004
            },
            {
              "month": "1404-01",
              "value": 6858
            },
            {
              "month": "1404-02",
              "value": 6720
            },
            {
              "month": "1404-03",
              "value": 6520
            },
            {
              "month": "1404-04",
              "value": 6420
            },
            {
              "month": "1404-05",
              "value": 6331
            },
            {
              "month": "1404-06",
              "value": 6246
            },
            {
              "month": "1404-07",
              "value": 6171
            },
            {
              "month": "1404-08",
              "value": 6110
            },
            {
              "month": "1404-09",
              "value": 5993
            },
            {
              "month": "1404-10",
              "value": 5985
            },
            {
              "month": "1404-11",
              "value": 5897
            },
            {
              "month": "1404-12",
              "value": 5864
            },
            {
              "month": "1405-01",
              "value": 5743
            },
            {
              "month": "1405-02",
              "value": 5556
            },
            {
              "month": "1405-03",
              "value": 5393
            }
          ]
        }
      },
      "soroushplus": {
        "azmaa_net": {
          "handle": "azmaa_net",
          "series": [
            {
              "month": "1403-04",
              "value": 1100
            },
            {
              "month": "1403-05",
              "value": 1100
            },
            {
              "month": "1403-06",
              "value": 1100
            },
            {
              "month": "1403-07",
              "value": 1100
            },
            {
              "month": "1403-08",
              "value": 1100
            },
            {
              "month": "1403-09",
              "value": 1100
            },
            {
              "month": "1403-10",
              "value": 1255
            },
            {
              "month": "1403-11",
              "value": 1270
            },
            {
              "month": "1403-12",
              "value": 1220
            },
            {
              "month": "1404-01",
              "value": 1100
            },
            {
              "month": "1404-05",
              "value": 0
            },
            {
              "month": "1404-06",
              "value": 0
            },
            {
              "month": "1404-07",
              "value": 1100
            },
            {
              "month": "1404-11",
              "value": 816
            },
            {
              "month": "1404-12",
              "value": 817
            },
            {
              "month": "1405-01",
              "value": 823
            },
            {
              "month": "1405-02",
              "value": 812
            },
            {
              "month": "1405-03",
              "value": 804
            }
          ]
        }
      }
    }
  },
  {
    "name": "نود اقتصادی",
    "platforms": {
      "telegram": {
        "NavadeEghtesadi": {
          "handle": "NavadeEghtesadi",
          "series": [
            {
              "month": "1403-04",
              "value": 23495
            },
            {
              "month": "1403-05",
              "value": 23418
            },
            {
              "month": "1403-06",
              "value": 23276
            },
            {
              "month": "1403-07",
              "value": 23043
            },
            {
              "month": "1403-08",
              "value": 23082
            },
            {
              "month": "1403-09",
              "value": 24494
            },
            {
              "month": "1403-10",
              "value": 24176
            },
            {
              "month": "1403-11",
              "value": 23929
            },
            {
              "month": "1403-12",
              "value": 23800
            },
            {
              "month": "1404-01",
              "value": 23563
            },
            {
              "month": "1404-02",
              "value": 23376
            },
            {
              "month": "1404-03",
              "value": 23062
            },
            {
              "month": "1404-04",
              "value": 22879
            },
            {
              "month": "1404-05",
              "value": 22743
            },
            {
              "month": "1404-06",
              "value": 22559
            },
            {
              "month": "1404-07",
              "value": 22439
            },
            {
              "month": "1404-08",
              "value": 22293
            },
            {
              "month": "1404-09",
              "value": 22219
            },
            {
              "month": "1404-10",
              "value": 22144
            },
            {
              "month": "1404-11",
              "value": 23360
            },
            {
              "month": "1404-12",
              "value": 22747
            },
            {
              "month": "1405-01",
              "value": 22657
            },
            {
              "month": "1405-02",
              "value": 22565
            },
            {
              "month": "1405-03",
              "value": 23529
            }
          ]
        }
      },
      "instagram": {
        "90eghtesadi": {
          "handle": "90eghtesadi",
          "series": [
            {
              "month": "1403-04",
              "value": 3564
            },
            {
              "month": "1403-05",
              "value": 3581
            },
            {
              "month": "1403-06",
              "value": 3603
            },
            {
              "month": "1403-07",
              "value": 3596
            },
            {
              "month": "1403-08",
              "value": 2301
            },
            {
              "month": "1403-09",
              "value": 2468
            },
            {
              "month": "1403-10",
              "value": 2854
            },
            {
              "month": "1403-11",
              "value": 3727
            },
            {
              "month": "1403-12",
              "value": 4276
            },
            {
              "month": "1404-01",
              "value": 4435
            },
            {
              "month": "1404-02",
              "value": 11600
            },
            {
              "month": "1404-03",
              "value": 15400
            },
            {
              "month": "1404-04",
              "value": 16400
            },
            {
              "month": "1404-05",
              "value": 18000
            },
            {
              "month": "1404-06",
              "value": 18700
            },
            {
              "month": "1404-07",
              "value": 20000
            },
            {
              "month": "1404-08",
              "value": 20121
            }
          ]
        },
        "ecograph90": {
          "handle": "ecograph90",
          "series": [
            {
              "month": "1403-09",
              "value": 8
            }
          ]
        },
        "90eghtesadi.official": {
          "handle": "90eghtesadi.official",
          "series": [
            {
              "month": "1404-09",
              "value": 20200
            },
            {
              "month": "1404-10",
              "value": 20100
            },
            {
              "month": "1404-11",
              "value": 20128
            },
            {
              "month": "1404-12",
              "value": 20200
            },
            {
              "month": "1405-01",
              "value": 20118
            },
            {
              "month": "1405-02",
              "value": 20200
            },
            {
              "month": "1405-03",
              "value": 26300
            }
          ]
        }
      },
      "twitter": {
        "NavadeEghtesadi": {
          "handle": "NavadeEghtesadi",
          "series": [
            {
              "month": "1403-04",
              "value": 25814
            },
            {
              "month": "1403-05",
              "value": 25816
            },
            {
              "month": "1403-06",
              "value": 25589
            },
            {
              "month": "1403-07",
              "value": 23900
            },
            {
              "month": "1403-08",
              "value": 23861
            },
            {
              "month": "1403-09",
              "value": 23839
            },
            {
              "month": "1403-10",
              "value": 23915
            },
            {
              "month": "1403-11",
              "value": 23984
            },
            {
              "month": "1403-12",
              "value": 24041
            },
            {
              "month": "1404-01",
              "value": 24157
            },
            {
              "month": "1404-02",
              "value": 24200
            },
            {
              "month": "1404-03",
              "value": 24253
            },
            {
              "month": "1404-04",
              "value": 24261
            },
            {
              "month": "1404-05",
              "value": 24200
            },
            {
              "month": "1404-06",
              "value": 24253
            },
            {
              "month": "1404-07",
              "value": 24229
            },
            {
              "month": "1404-08",
              "value": 24161
            },
            {
              "month": "1404-09",
              "value": 24133
            },
            {
              "month": "1404-10",
              "value": 24145
            },
            {
              "month": "1404-11",
              "value": 24150
            },
            {
              "month": "1404-12",
              "value": 23977
            },
            {
              "month": "1405-01",
              "value": 23924
            },
            {
              "month": "1405-02",
              "value": 23800
            },
            {
              "month": "1405-03",
              "value": 23952
            }
          ]
        }
      },
      "rubika": {
        "navadeeghtesadi": {
          "handle": "navadeeghtesadi",
          "series": [
            {
              "month": "1403-04",
              "value": 54353
            },
            {
              "month": "1403-05",
              "value": 53943
            },
            {
              "month": "1403-06",
              "value": 53361
            },
            {
              "month": "1403-07",
              "value": 52381
            },
            {
              "month": "1403-08",
              "value": 51039
            },
            {
              "month": "1403-09",
              "value": 50864
            },
            {
              "month": "1403-10",
              "value": 52545
            },
            {
              "month": "1403-11",
              "value": 51633
            },
            {
              "month": "1403-12",
              "value": 51620
            },
            {
              "month": "1404-01",
              "value": 50991
            },
            {
              "month": "1404-02",
              "value": 50991
            },
            {
              "month": "1404-03",
              "value": 52760
            },
            {
              "month": "1404-04",
              "value": 52170
            },
            {
              "month": "1404-05",
              "value": 51596
            },
            {
              "month": "1404-06",
              "value": 51104
            },
            {
              "month": "1404-07",
              "value": 50693
            },
            {
              "month": "1404-08",
              "value": 50295
            }
          ]
        },
        "NavadeEghtesadi": {
          "handle": "NavadeEghtesadi",
          "series": [
            {
              "month": "1404-09",
              "value": 49901
            },
            {
              "month": "1404-10",
              "value": 54600
            },
            {
              "month": "1404-11",
              "value": 53872
            },
            {
              "month": "1404-12",
              "value": 55100
            },
            {
              "month": "1405-01",
              "value": 54869
            },
            {
              "month": "1405-02",
              "value": 53842
            },
            {
              "month": "1405-03",
              "value": 52238
            }
          ]
        }
      },
      "eita": {
        "navadeeghtesadi": {
          "handle": "navadeeghtesadi",
          "series": [
            {
              "month": "1403-04",
              "value": 1700
            },
            {
              "month": "1403-05",
              "value": 1660
            },
            {
              "month": "1403-06",
              "value": 1630
            },
            {
              "month": "1403-07",
              "value": 1600
            },
            {
              "month": "1403-08",
              "value": 1725
            },
            {
              "month": "1403-09",
              "value": 1769
            },
            {
              "month": "1403-10",
              "value": 1817
            },
            {
              "month": "1403-11",
              "value": 1846
            },
            {
              "month": "1403-12",
              "value": 1883
            },
            {
              "month": "1404-01",
              "value": 1922
            },
            {
              "month": "1404-02",
              "value": 1930
            },
            {
              "month": "1404-03",
              "value": 1953
            },
            {
              "month": "1404-04",
              "value": 1965
            },
            {
              "month": "1404-05",
              "value": 1978
            },
            {
              "month": "1404-06",
              "value": 1978
            },
            {
              "month": "1404-07",
              "value": 1966
            },
            {
              "month": "1404-08",
              "value": 1971
            }
          ]
        },
        "NavadeEghtesadi": {
          "handle": "NavadeEghtesadi",
          "series": [
            {
              "month": "1404-09",
              "value": 2002
            },
            {
              "month": "1404-10",
              "value": 2064
            },
            {
              "month": "1404-11",
              "value": 2071
            },
            {
              "month": "1404-12",
              "value": 2108
            },
            {
              "month": "1405-01",
              "value": 2756
            },
            {
              "month": "1405-02",
              "value": 2615
            },
            {
              "month": "1405-03",
              "value": 2580
            }
          ]
        }
      },
      "youtube": {
        "user-hv6ek5pf5d": {
          "handle": "user-hv6ek5pf5d",
          "series": [
            {
              "month": "1403-04",
              "value": 134
            },
            {
              "month": "1403-07",
              "value": 135
            },
            {
              "month": "1403-08",
              "value": 167
            },
            {
              "month": "1403-09",
              "value": 176
            },
            {
              "month": "1403-10",
              "value": 187
            },
            {
              "month": "1403-11",
              "value": 190
            },
            {
              "month": "1403-12",
              "value": 190
            },
            {
              "month": "1404-01",
              "value": 193
            },
            {
              "month": "1404-03",
              "value": 202
            }
          ]
        }
      },
      "bale": {
        "navadeeghtesadi": {
          "handle": "navadeeghtesadi",
          "series": [
            {
              "month": "1403-07",
              "value": 3993
            },
            {
              "month": "1403-08",
              "value": 3991
            },
            {
              "month": "1403-09",
              "value": 3990
            },
            {
              "month": "1403-10",
              "value": 3985
            },
            {
              "month": "1403-11",
              "value": 3980
            },
            {
              "month": "1403-12",
              "value": 3970
            },
            {
              "month": "1404-01",
              "value": 3960
            },
            {
              "month": "1404-02",
              "value": 3950
            },
            {
              "month": "1404-03",
              "value": 3940
            },
            {
              "month": "1404-04",
              "value": 3916
            },
            {
              "month": "1404-05",
              "value": 3923
            },
            {
              "month": "1404-07",
              "value": 3891
            }
          ]
        },
        "user-hv6ek5pf5d": {
          "handle": "user-hv6ek5pf5d",
          "series": [
            {
              "month": "1404-06",
              "value": 3915
            }
          ]
        },
        "ble.ir/navadeeghtesadi": {
          "handle": "ble.ir/navadeeghtesadi",
          "series": [
            {
              "month": "1404-08",
              "value": 3882
            }
          ]
        },
        "NavadeEghtesadi": {
          "handle": "NavadeEghtesadi",
          "series": [
            {
              "month": "1404-09",
              "value": 3879
            },
            {
              "month": "1404-10",
              "value": 3900
            },
            {
              "month": "1404-11",
              "value": 3906
            },
            {
              "month": "1404-12",
              "value": 4496
            },
            {
              "month": "1405-01",
              "value": 4862
            },
            {
              "month": "1405-02",
              "value": 5380
            },
            {
              "month": "1405-03",
              "value": 5300
            }
          ]
        }
      },
      "soroushplus": {
        "NavadeEghtesadi": {
          "handle": "NavadeEghtesadi",
          "series": [
            {
              "month": "1404-09",
              "value": 5400
            },
            {
              "month": "1404-10",
              "value": 1700
            },
            {
              "month": "1404-11",
              "value": 5400
            },
            {
              "month": "1404-12",
              "value": 5400
            },
            {
              "month": "1405-01",
              "value": 24500
            },
            {
              "month": "1405-02",
              "value": 23300
            },
            {
              "month": "1405-03",
              "value": 21430
            }
          ]
        }
      }
    }
  },
  {
    "name": "نسیم آنلاین",
    "platforms": {
      "telegram": {
        "nasimonline": {
          "handle": "nasimonline",
          "series": [
            {
              "month": "1403-04",
              "value": 11931
            },
            {
              "month": "1403-05",
              "value": 11958
            },
            {
              "month": "1403-06",
              "value": 11583
            },
            {
              "month": "1403-07",
              "value": 11306
            },
            {
              "month": "1403-08",
              "value": 11154
            },
            {
              "month": "1403-09",
              "value": 11012
            },
            {
              "month": "1403-10",
              "value": 10889
            },
            {
              "month": "1403-11",
              "value": 10756
            },
            {
              "month": "1403-12",
              "value": 10620
            },
            {
              "month": "1404-01",
              "value": 10890
            },
            {
              "month": "1404-02",
              "value": 10658
            },
            {
              "month": "1404-03",
              "value": 10468
            },
            {
              "month": "1404-04",
              "value": 11605
            },
            {
              "month": "1404-05",
              "value": 10943
            },
            {
              "month": "1404-06",
              "value": 10335
            },
            {
              "month": "1404-07",
              "value": 10138
            },
            {
              "month": "1404-08",
              "value": 20965
            },
            {
              "month": "1404-09",
              "value": 17217
            },
            {
              "month": "1404-10",
              "value": 17296
            },
            {
              "month": "1404-11",
              "value": 16416
            },
            {
              "month": "1404-12",
              "value": 15860
            },
            {
              "month": "1405-01",
              "value": 15580
            },
            {
              "month": "1405-02",
              "value": 15111
            },
            {
              "month": "1405-03",
              "value": 13500
            }
          ]
        }
      },
      "instagram": {
        "nasimonline1": {
          "handle": "nasimonline1",
          "series": [
            {
              "month": "1403-04",
              "value": 9500
            },
            {
              "month": "1403-05",
              "value": 9500
            },
            {
              "month": "1403-06",
              "value": 9421
            },
            {
              "month": "1403-07",
              "value": 6459
            },
            {
              "month": "1403-08",
              "value": 9448
            },
            {
              "month": "1403-09",
              "value": 9807
            },
            {
              "month": "1403-10",
              "value": 10089
            },
            {
              "month": "1403-11",
              "value": 10278
            },
            {
              "month": "1403-12",
              "value": 10306
            },
            {
              "month": "1404-01",
              "value": 10369
            },
            {
              "month": "1404-02",
              "value": 10407
            },
            {
              "month": "1404-03",
              "value": 10527
            },
            {
              "month": "1404-04",
              "value": 10576
            },
            {
              "month": "1404-05",
              "value": 10559
            },
            {
              "month": "1404-06",
              "value": 10540
            },
            {
              "month": "1404-07",
              "value": 10540
            },
            {
              "month": "1404-08",
              "value": 10428
            },
            {
              "month": "1404-09",
              "value": 10392
            },
            {
              "month": "1404-10",
              "value": 10392
            },
            {
              "month": "1404-11",
              "value": 10300
            },
            {
              "month": "1404-12",
              "value": 10300
            },
            {
              "month": "1405-01",
              "value": 10300
            },
            {
              "month": "1405-02",
              "value": 10300
            },
            {
              "month": "1405-03",
              "value": 10300
            }
          ]
        }
      },
      "twitter": {
        "NasimOnline_Ir": {
          "handle": "NasimOnline_Ir",
          "series": [
            {
              "month": "1403-04",
              "value": 2196
            },
            {
              "month": "1403-05",
              "value": 2185
            },
            {
              "month": "1403-06",
              "value": 2156
            },
            {
              "month": "1403-07",
              "value": 2085
            },
            {
              "month": "1403-08",
              "value": 2066
            },
            {
              "month": "1403-09",
              "value": 2057
            },
            {
              "month": "1403-10",
              "value": 2048
            },
            {
              "month": "1403-11",
              "value": 2042
            },
            {
              "month": "1403-12",
              "value": 2042
            },
            {
              "month": "1404-01",
              "value": 2042
            },
            {
              "month": "1404-02",
              "value": 2042
            },
            {
              "month": "1404-03",
              "value": 2042
            },
            {
              "month": "1404-04",
              "value": 2042
            },
            {
              "month": "1404-05",
              "value": 2042
            },
            {
              "month": "1404-06",
              "value": 2042
            },
            {
              "month": "1404-07",
              "value": 2042
            },
            {
              "month": "1404-08",
              "value": 1996
            },
            {
              "month": "1404-09",
              "value": 1981
            },
            {
              "month": "1404-10",
              "value": 1978
            },
            {
              "month": "1404-11",
              "value": 1981
            },
            {
              "month": "1404-12",
              "value": 1981
            },
            {
              "month": "1405-01",
              "value": 1981
            },
            {
              "month": "1405-02",
              "value": 1981
            },
            {
              "month": "1405-03",
              "value": 1981
            }
          ]
        }
      },
      "soroushplus": {
        "nasimonline": {
          "handle": "nasimonline",
          "series": [
            {
              "month": "1403-04",
              "value": 120900
            },
            {
              "month": "1403-05",
              "value": 120700
            },
            {
              "month": "1403-06",
              "value": 120500
            },
            {
              "month": "1403-07",
              "value": 120235
            },
            {
              "month": "1403-08",
              "value": 120010
            },
            {
              "month": "1403-09",
              "value": 119851
            },
            {
              "month": "1403-10",
              "value": 119666
            },
            {
              "month": "1403-11",
              "value": 119518
            },
            {
              "month": "1403-12",
              "value": 119394
            },
            {
              "month": "1404-01",
              "value": 119286
            },
            {
              "month": "1404-02",
              "value": 119172
            },
            {
              "month": "1404-03",
              "value": 152867
            },
            {
              "month": "1404-04",
              "value": 162158
            },
            {
              "month": "1404-05",
              "value": 167183
            },
            {
              "month": "1404-06",
              "value": 168551
            },
            {
              "month": "1404-07",
              "value": 167790
            },
            {
              "month": "1404-08",
              "value": 167300
            },
            {
              "month": "1404-09",
              "value": 169735
            },
            {
              "month": "1404-10",
              "value": 169025
            },
            {
              "month": "1404-11",
              "value": 168272
            },
            {
              "month": "1404-12",
              "value": 504384
            },
            {
              "month": "1405-01",
              "value": 604744
            },
            {
              "month": "1405-02",
              "value": 628692
            },
            {
              "month": "1405-03",
              "value": 604368
            }
          ]
        }
      },
      "rubika": {
        "NasimOnline": {
          "handle": "NasimOnline",
          "series": [
            {
              "month": "1403-04",
              "value": 89
            },
            {
              "month": "1403-05",
              "value": 89
            },
            {
              "month": "1403-06",
              "value": 89
            },
            {
              "month": "1403-07",
              "value": 87
            },
            {
              "month": "1403-08",
              "value": 87
            },
            {
              "month": "1403-09",
              "value": 86
            },
            {
              "month": "1403-10",
              "value": 86
            },
            {
              "month": "1403-11",
              "value": 86
            },
            {
              "month": "1403-12",
              "value": 86
            },
            {
              "month": "1404-01",
              "value": 86
            },
            {
              "month": "1404-02",
              "value": 86
            },
            {
              "month": "1404-03",
              "value": 86
            },
            {
              "month": "1404-04",
              "value": 86
            },
            {
              "month": "1404-05",
              "value": 86
            },
            {
              "month": "1404-06",
              "value": 86
            },
            {
              "month": "1404-07",
              "value": 199
            },
            {
              "month": "1404-08",
              "value": 192
            },
            {
              "month": "1404-09",
              "value": 187
            },
            {
              "month": "1404-10",
              "value": 222
            },
            {
              "month": "1404-11",
              "value": 225
            },
            {
              "month": "1404-12",
              "value": 372
            },
            {
              "month": "1405-01",
              "value": 387
            },
            {
              "month": "1405-02",
              "value": 368
            },
            {
              "month": "1405-03",
              "value": 354
            }
          ]
        }
      },
      "bale": {
        "NasimOnline": {
          "handle": "NasimOnline",
          "series": [
            {
              "month": "1403-04",
              "value": 4300
            },
            {
              "month": "1403-05",
              "value": 4326
            },
            {
              "month": "1403-06",
              "value": 4290
            },
            {
              "month": "1403-07",
              "value": 4218
            },
            {
              "month": "1403-08",
              "value": 4201
            },
            {
              "month": "1403-09",
              "value": 4173
            },
            {
              "month": "1403-10",
              "value": 4154
            },
            {
              "month": "1403-11",
              "value": 4147
            },
            {
              "month": "1403-12",
              "value": 4132
            },
            {
              "month": "1404-01",
              "value": 4121
            },
            {
              "month": "1404-02",
              "value": 4116
            },
            {
              "month": "1404-03",
              "value": 4349
            },
            {
              "month": "1404-04",
              "value": 4319
            },
            {
              "month": "1404-05",
              "value": 4302
            },
            {
              "month": "1404-06",
              "value": 4294
            },
            {
              "month": "1404-07",
              "value": 4305
            },
            {
              "month": "1404-08",
              "value": 4341
            },
            {
              "month": "1404-09",
              "value": 4349
            },
            {
              "month": "1404-10",
              "value": 5756
            },
            {
              "month": "1404-11",
              "value": 5965
            },
            {
              "month": "1404-12",
              "value": 11034
            },
            {
              "month": "1405-01",
              "value": 11188
            },
            {
              "month": "1405-02",
              "value": 11498
            },
            {
              "month": "1405-03",
              "value": 10863
            }
          ]
        }
      },
      "eita": {
        "NasimOnline": {
          "handle": "NasimOnline",
          "series": [
            {
              "month": "1403-04",
              "value": 3000
            },
            {
              "month": "1403-05",
              "value": 3000
            },
            {
              "month": "1403-06",
              "value": 3000
            },
            {
              "month": "1403-07",
              "value": 2993
            },
            {
              "month": "1403-08",
              "value": 2963
            },
            {
              "month": "1403-09",
              "value": 2958
            },
            {
              "month": "1403-10",
              "value": 2948
            },
            {
              "month": "1403-11",
              "value": 2930
            },
            {
              "month": "1403-12",
              "value": 2925
            },
            {
              "month": "1404-01",
              "value": 2917
            },
            {
              "month": "1404-02",
              "value": 2906
            },
            {
              "month": "1404-03",
              "value": 3032
            },
            {
              "month": "1404-04",
              "value": 3001
            },
            {
              "month": "1404-05",
              "value": 3135
            },
            {
              "month": "1404-06",
              "value": 3956
            },
            {
              "month": "1404-07",
              "value": 3788
            },
            {
              "month": "1404-08",
              "value": 3665
            },
            {
              "month": "1404-09",
              "value": 3593
            },
            {
              "month": "1404-10",
              "value": 3544
            },
            {
              "month": "1404-11",
              "value": 3501
            },
            {
              "month": "1404-12",
              "value": 3459
            },
            {
              "month": "1405-01",
              "value": 3412
            },
            {
              "month": "1405-02",
              "value": 3366
            },
            {
              "month": "1405-03",
              "value": 3345
            }
          ]
        }
      },
      "youtube": {
        "nasimonline7535": {
          "handle": "nasimonline7535",
          "series": [
            {
              "month": "1403-04",
              "value": 400
            },
            {
              "month": "1403-05",
              "value": 412
            },
            {
              "month": "1403-06",
              "value": 435
            },
            {
              "month": "1403-07",
              "value": 444
            },
            {
              "month": "1403-08",
              "value": 481
            },
            {
              "month": "1403-09",
              "value": 522
            },
            {
              "month": "1403-10",
              "value": 533
            },
            {
              "month": "1403-11",
              "value": 547
            },
            {
              "month": "1403-12",
              "value": 559
            },
            {
              "month": "1404-01",
              "value": 574
            },
            {
              "month": "1404-02",
              "value": 580
            },
            {
              "month": "1404-03",
              "value": 588
            },
            {
              "month": "1404-04",
              "value": 596
            },
            {
              "month": "1404-05",
              "value": 602
            },
            {
              "month": "1404-06",
              "value": 602
            },
            {
              "month": "1404-07",
              "value": 602
            },
            {
              "month": "1404-08",
              "value": 602
            },
            {
              "month": "1404-09",
              "value": 606
            },
            {
              "month": "1404-10",
              "value": 606
            },
            {
              "month": "1404-11",
              "value": 606
            },
            {
              "month": "1404-12",
              "value": 606
            },
            {
              "month": "1405-01",
              "value": 606
            },
            {
              "month": "1405-02",
              "value": 606
            },
            {
              "month": "1405-03",
              "value": 606
            }
          ]
        }
      }
    }
  },
  {
    "name": "دیده بان دولت",
    "platforms": {
      "telegram": {
        "didebandolat": {
          "handle": "didebandolat",
          "series": [
            {
              "month": "1403-04",
              "value": 5540
            },
            {
              "month": "1403-07",
              "value": 4772
            },
            {
              "month": "1403-08",
              "value": 4696
            },
            {
              "month": "1403-09",
              "value": 4603
            },
            {
              "month": "1403-10",
              "value": 4528
            },
            {
              "month": "1403-11",
              "value": 4455
            },
            {
              "month": "1403-12",
              "value": 4407
            },
            {
              "month": "1404-01",
              "value": 4333
            },
            {
              "month": "1404-02",
              "value": 4265
            },
            {
              "month": "1404-03",
              "value": 4195
            },
            {
              "month": "1404-04",
              "value": 4122
            },
            {
              "month": "1404-05",
              "value": 4059
            }
          ]
        }
      },
      "instagram": {
        "didebandolat": {
          "handle": "didebandolat",
          "series": [
            {
              "month": "1403-07",
              "value": 20865
            },
            {
              "month": "1403-08",
              "value": 20804
            },
            {
              "month": "1403-09",
              "value": 20733
            },
            {
              "month": "1403-10",
              "value": 20641
            },
            {
              "month": "1403-11",
              "value": 20523
            },
            {
              "month": "1403-12",
              "value": 20478
            },
            {
              "month": "1404-01",
              "value": 20452
            },
            {
              "month": "1404-02",
              "value": 20431
            },
            {
              "month": "1404-03",
              "value": 20403
            },
            {
              "month": "1404-04",
              "value": 20367
            },
            {
              "month": "1404-05",
              "value": 20349
            }
          ]
        }
      },
      "eita": {
        "didebandolat": {
          "handle": "didebandolat",
          "series": [
            {
              "month": "1403-07",
              "value": 3488
            },
            {
              "month": "1403-08",
              "value": 3427
            },
            {
              "month": "1403-09",
              "value": 3384
            },
            {
              "month": "1403-10",
              "value": 3342
            },
            {
              "month": "1403-11",
              "value": 3314
            },
            {
              "month": "1403-12",
              "value": 3277
            },
            {
              "month": "1404-01",
              "value": 3244
            },
            {
              "month": "1404-02",
              "value": 3207
            },
            {
              "month": "1404-03",
              "value": 3184
            },
            {
              "month": "1404-04",
              "value": 3169
            },
            {
              "month": "1404-05",
              "value": 3118
            }
          ]
        }
      },
      "bale": {
        "didebandolat": {
          "handle": "didebandolat",
          "series": [
            {
              "month": "1403-07",
              "value": 89
            },
            {
              "month": "1403-08",
              "value": 87
            },
            {
              "month": "1403-09",
              "value": 87
            },
            {
              "month": "1403-10",
              "value": 87
            },
            {
              "month": "1403-11",
              "value": 87
            },
            {
              "month": "1403-12",
              "value": 87
            },
            {
              "month": "1404-01",
              "value": 87
            },
            {
              "month": "1404-02",
              "value": 87
            },
            {
              "month": "1404-03",
              "value": 87
            },
            {
              "month": "1404-04",
              "value": 87
            },
            {
              "month": "1404-05",
              "value": 87
            }
          ]
        }
      },
      "soroushplus": {
        "didebandolat": {
          "handle": "didebandolat",
          "series": [
            {
              "month": "1403-07",
              "value": 47250
            },
            {
              "month": "1403-08",
              "value": 46964
            },
            {
              "month": "1403-09",
              "value": 46838
            },
            {
              "month": "1403-10",
              "value": 46748
            },
            {
              "month": "1403-11",
              "value": 46676
            },
            {
              "month": "1403-12",
              "value": 46628
            },
            {
              "month": "1404-01",
              "value": 46593
            },
            {
              "month": "1404-02",
              "value": 46522
            },
            {
              "month": "1404-03",
              "value": 46373
            },
            {
              "month": "1404-04",
              "value": 46273
            },
            {
              "month": "1404-05",
              "value": 46209
            }
          ]
        }
      },
      "twitter": {
        "didebanedolat": {
          "handle": "didebanedolat",
          "series": [
            {
              "month": "1403-07",
              "value": 7
            },
            {
              "month": "1403-08",
              "value": 14
            },
            {
              "month": "1403-09",
              "value": 11
            },
            {
              "month": "1403-10",
              "value": 10
            },
            {
              "month": "1403-11",
              "value": 10
            },
            {
              "month": "1403-12",
              "value": 10
            },
            {
              "month": "1404-01",
              "value": 10
            },
            {
              "month": "1404-02",
              "value": 10
            },
            {
              "month": "1404-03",
              "value": 10
            },
            {
              "month": "1404-04",
              "value": 10
            },
            {
              "month": "1404-05",
              "value": 10
            }
          ]
        }
      }
    }
  },
  {
    "name": "روشنگری",
    "platforms": {
      "telegram": {
        "roshangari_ir": {
          "handle": "roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 48164
            },
            {
              "month": "1403-05",
              "value": 45774
            },
            {
              "month": "1403-06",
              "value": 43751
            },
            {
              "month": "1403-07",
              "value": 42170
            },
            {
              "month": "1403-08",
              "value": 41315
            },
            {
              "month": "1403-09",
              "value": 40676
            },
            {
              "month": "1403-10",
              "value": 39925
            },
            {
              "month": "1403-11",
              "value": 42531
            },
            {
              "month": "1403-12",
              "value": 41087
            },
            {
              "month": "1404-01",
              "value": 40058
            },
            {
              "month": "1404-02",
              "value": 39167
            },
            {
              "month": "1404-03",
              "value": 39322
            },
            {
              "month": "1404-04",
              "value": 38345
            },
            {
              "month": "1404-05",
              "value": 37546
            },
            {
              "month": "1404-06",
              "value": 36800
            },
            {
              "month": "1404-07",
              "value": 36013
            },
            {
              "month": "1404-08",
              "value": 35429
            },
            {
              "month": "1404-09",
              "value": 34937
            },
            {
              "month": "1404-10",
              "value": 46949
            },
            {
              "month": "1404-11",
              "value": 42673
            },
            {
              "month": "1404-12",
              "value": 41371
            },
            {
              "month": "1405-01",
              "value": 41305
            },
            {
              "month": "1405-02",
              "value": 41027
            },
            {
              "month": "1405-03",
              "value": 38375
            }
          ]
        }
      },
      "eita": {
        "Roshangari_ir": {
          "handle": "Roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 115400
            },
            {
              "month": "1403-05",
              "value": 114800
            },
            {
              "month": "1403-06",
              "value": 113019
            },
            {
              "month": "1403-07",
              "value": 112562
            },
            {
              "month": "1403-08",
              "value": 113479
            },
            {
              "month": "1403-09",
              "value": 112607
            },
            {
              "month": "1403-10",
              "value": 112229
            },
            {
              "month": "1403-11",
              "value": 111691
            },
            {
              "month": "1403-12",
              "value": 111641
            },
            {
              "month": "1404-01",
              "value": 111941
            },
            {
              "month": "1404-02",
              "value": 111193
            },
            {
              "month": "1404-03",
              "value": 124018
            },
            {
              "month": "1404-04",
              "value": 121752
            },
            {
              "month": "1404-05",
              "value": 119627
            },
            {
              "month": "1404-06",
              "value": 119013
            },
            {
              "month": "1404-07",
              "value": 117426
            },
            {
              "month": "1404-08",
              "value": 116657
            },
            {
              "month": "1404-09",
              "value": 116201
            },
            {
              "month": "1404-10",
              "value": 119332
            },
            {
              "month": "1404-11",
              "value": 119421
            },
            {
              "month": "1404-12",
              "value": 130370
            },
            {
              "month": "1405-01",
              "value": 130220
            },
            {
              "month": "1405-02",
              "value": 127950
            },
            {
              "month": "1405-03",
              "value": 124711
            }
          ]
        }
      },
      "rubika": {
        "Roshangari_ir": {
          "handle": "Roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 12967
            },
            {
              "month": "1403-05",
              "value": 13067
            },
            {
              "month": "1403-06",
              "value": 13087
            },
            {
              "month": "1403-07",
              "value": 13301
            },
            {
              "month": "1403-08",
              "value": 13371
            },
            {
              "month": "1403-09",
              "value": 13543
            },
            {
              "month": "1403-10",
              "value": 13592
            },
            {
              "month": "1403-11",
              "value": 13554
            },
            {
              "month": "1403-12",
              "value": 13508
            },
            {
              "month": "1404-01",
              "value": 13623
            },
            {
              "month": "1404-02",
              "value": 13621
            },
            {
              "month": "1404-03",
              "value": 16414
            },
            {
              "month": "1404-04",
              "value": 16254
            },
            {
              "month": "1404-05",
              "value": 16022
            },
            {
              "month": "1404-06",
              "value": 15870
            },
            {
              "month": "1404-07",
              "value": 15754
            },
            {
              "month": "1404-08",
              "value": 15645
            },
            {
              "month": "1404-09",
              "value": 15600
            },
            {
              "month": "1404-10",
              "value": 16800
            },
            {
              "month": "1404-11",
              "value": 17168
            },
            {
              "month": "1404-12",
              "value": 20451
            },
            {
              "month": "1405-01",
              "value": 22789
            },
            {
              "month": "1405-02",
              "value": 22517
            },
            {
              "month": "1405-03",
              "value": 21994
            }
          ]
        }
      },
      "bale": {
        "roshangari_ir": {
          "handle": "roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 6500
            },
            {
              "month": "1403-05",
              "value": 6533
            },
            {
              "month": "1403-06",
              "value": 6472
            },
            {
              "month": "1403-07",
              "value": 6670
            },
            {
              "month": "1403-08",
              "value": 6669
            },
            {
              "month": "1403-09",
              "value": 6738
            },
            {
              "month": "1403-10",
              "value": 6749
            },
            {
              "month": "1403-11",
              "value": 6744
            },
            {
              "month": "1403-12",
              "value": 6777
            },
            {
              "month": "1404-01",
              "value": 6777
            },
            {
              "month": "1404-02",
              "value": 7161
            },
            {
              "month": "1404-03",
              "value": 15300
            },
            {
              "month": "1404-04",
              "value": 14537
            },
            {
              "month": "1404-05",
              "value": 14536
            },
            {
              "month": "1404-06",
              "value": 15200
            },
            {
              "month": "1404-07",
              "value": 15008
            },
            {
              "month": "1404-08",
              "value": 14643
            },
            {
              "month": "1404-09",
              "value": 14410
            },
            {
              "month": "1404-10",
              "value": 14672
            },
            {
              "month": "1404-11",
              "value": 15409
            },
            {
              "month": "1404-12",
              "value": 30800
            },
            {
              "month": "1405-01",
              "value": 31244
            },
            {
              "month": "1405-02",
              "value": 30345
            },
            {
              "month": "1405-03",
              "value": 29121
            }
          ]
        }
      },
      "soroushplus": {
        "roshangarii": {
          "handle": "roshangarii",
          "series": [
            {
              "month": "1403-04",
              "value": 56100
            },
            {
              "month": "1403-05",
              "value": 52300
            },
            {
              "month": "1403-06",
              "value": 52400
            },
            {
              "month": "1403-07",
              "value": 68220
            },
            {
              "month": "1403-08",
              "value": 74772
            },
            {
              "month": "1403-09",
              "value": 80602
            }
          ]
        },
        "roshangari_ir": {
          "handle": "roshangari_ir",
          "series": [
            {
              "month": "1403-10",
              "value": 86281
            },
            {
              "month": "1403-11",
              "value": 91199
            },
            {
              "month": "1403-12",
              "value": 94635
            },
            {
              "month": "1404-01",
              "value": 98470
            },
            {
              "month": "1404-02",
              "value": 100592
            },
            {
              "month": "1404-03",
              "value": 132718
            },
            {
              "month": "1404-04",
              "value": 140070
            },
            {
              "month": "1404-05",
              "value": 146303
            },
            {
              "month": "1404-06",
              "value": 147393
            },
            {
              "month": "1404-07",
              "value": 149210
            },
            {
              "month": "1404-08",
              "value": 148290
            },
            {
              "month": "1404-09",
              "value": 147589
            },
            {
              "month": "1404-10",
              "value": 148041
            },
            {
              "month": "1404-11",
              "value": 146639
            },
            {
              "month": "1404-12",
              "value": 147318
            },
            {
              "month": "1405-01",
              "value": 144411
            },
            {
              "month": "1405-02",
              "value": 142362
            },
            {
              "month": "1405-03",
              "value": 140321
            }
          ]
        }
      },
      "instagram": {
        "Roshangari_ir": {
          "handle": "Roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 1759
            },
            {
              "month": "1403-05",
              "value": 1759
            },
            {
              "month": "1403-06",
              "value": 1759
            },
            {
              "month": "1403-07",
              "value": 2309
            },
            {
              "month": "1403-08",
              "value": 2969
            },
            {
              "month": "1403-09",
              "value": 4213
            }
          ]
        },
        "Roshangari04": {
          "handle": "Roshangari04",
          "series": [
            {
              "month": "1403-10",
              "value": 4950
            },
            {
              "month": "1403-11",
              "value": 6776
            },
            {
              "month": "1403-12",
              "value": 11301
            },
            {
              "month": "1404-01",
              "value": 14800
            },
            {
              "month": "1404-02",
              "value": 15992
            },
            {
              "month": "1404-03",
              "value": 16414
            },
            {
              "month": "1404-04",
              "value": 17152
            },
            {
              "month": "1404-05",
              "value": 19900
            },
            {
              "month": "1404-06",
              "value": 22100
            },
            {
              "month": "1404-07",
              "value": 22471
            },
            {
              "month": "1404-08",
              "value": 22585
            },
            {
              "month": "1404-09",
              "value": 22656
            },
            {
              "month": "1404-10",
              "value": 22656
            },
            {
              "month": "1404-11",
              "value": 22648
            },
            {
              "month": "1404-12",
              "value": 22675
            },
            {
              "month": "1405-01",
              "value": 22693
            },
            {
              "month": "1405-02",
              "value": 22704
            },
            {
              "month": "1405-03",
              "value": 23127
            }
          ]
        }
      },
      "youtube": {
        "roshangari_ir": {
          "handle": "roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 880
            },
            {
              "month": "1403-07",
              "value": 884
            },
            {
              "month": "1403-08",
              "value": 884
            },
            {
              "month": "1403-09",
              "value": 884
            },
            {
              "month": "1403-10",
              "value": 884
            },
            {
              "month": "1403-11",
              "value": 884
            },
            {
              "month": "1403-12",
              "value": 884
            },
            {
              "month": "1404-01",
              "value": 884
            },
            {
              "month": "1404-02",
              "value": 884
            },
            {
              "month": "1404-03",
              "value": 884
            },
            {
              "month": "1404-04",
              "value": 884
            },
            {
              "month": "1404-05",
              "value": 884
            },
            {
              "month": "1404-06",
              "value": 884
            },
            {
              "month": "1404-07",
              "value": 884
            },
            {
              "month": "1404-08",
              "value": 887
            },
            {
              "month": "1404-09",
              "value": 884
            },
            {
              "month": "1404-10",
              "value": 884
            },
            {
              "month": "1404-11",
              "value": 884
            },
            {
              "month": "1404-12",
              "value": 884
            },
            {
              "month": "1405-01",
              "value": 884
            },
            {
              "month": "1405-02",
              "value": 884
            },
            {
              "month": "1405-03",
              "value": 884
            }
          ]
        }
      },
      "twitter": {
        "Roshangari_ir": {
          "handle": "Roshangari_ir",
          "series": [
            {
              "month": "1403-04",
              "value": 5293
            },
            {
              "month": "1403-07",
              "value": 5058
            },
            {
              "month": "1403-08",
              "value": 5020
            },
            {
              "month": "1403-09",
              "value": 4979
            },
            {
              "month": "1403-10",
              "value": 4981
            },
            {
              "month": "1403-11",
              "value": 4985
            },
            {
              "month": "1403-12",
              "value": 5002
            },
            {
              "month": "1404-01",
              "value": 5010
            },
            {
              "month": "1404-02",
              "value": 5003
            },
            {
              "month": "1404-03",
              "value": 5004
            },
            {
              "month": "1404-04",
              "value": 4999
            },
            {
              "month": "1404-05",
              "value": 4999
            },
            {
              "month": "1404-06",
              "value": 4999
            },
            {
              "month": "1404-07",
              "value": 4987
            },
            {
              "month": "1404-08",
              "value": 4962
            },
            {
              "month": "1404-09",
              "value": 4999
            },
            {
              "month": "1404-10",
              "value": 4939
            },
            {
              "month": "1404-11",
              "value": 4931
            },
            {
              "month": "1404-12",
              "value": 4931
            },
            {
              "month": "1405-01",
              "value": 4923
            },
            {
              "month": "1405-02",
              "value": 4923
            },
            {
              "month": "1405-03",
              "value": 4923
            }
          ]
        }
      }
    }
  },
  {
    "name": "پاراگراف",
    "platforms": {
      "twitter": {
        "paragraphmedia": {
          "handle": "paragraphmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 23
            }
          ]
        }
      },
      "instagram": {
        "paragraphmedia": {
          "handle": "paragraphmedia",
          "series": [
            {
              "month": "1403-04",
              "value": 4178
            }
          ]
        }
      }
    }
  },
  {
    "name": "فصل 11",
    "platforms": {
      "instagram": {
        "fasle_11": {
          "handle": "fasle_11",
          "series": [
            {
              "month": "1404-02",
              "value": 223
            },
            {
              "month": "1404-03",
              "value": 247
            },
            {
              "month": "1404-04",
              "value": 283
            },
            {
              "month": "1404-05",
              "value": 600
            },
            {
              "month": "1404-06",
              "value": 5417
            },
            {
              "month": "1404-07",
              "value": 10100
            },
            {
              "month": "1404-08",
              "value": 13000
            },
            {
              "month": "1404-09",
              "value": 17819
            },
            {
              "month": "1404-10",
              "value": 18241
            },
            {
              "month": "1404-11",
              "value": 18200
            },
            {
              "month": "1404-12",
              "value": 18300
            },
            {
              "month": "1405-01",
              "value": 18310
            },
            {
              "month": "1405-02",
              "value": 18282
            },
            {
              "month": "1405-03",
              "value": 23418
            }
          ]
        }
      },
      "telegram": {
        "fasle_11": {
          "handle": "fasle_11",
          "series": [
            {
              "month": "1404-02",
              "value": 140
            },
            {
              "month": "1404-03",
              "value": 146
            },
            {
              "month": "1404-04",
              "value": 148
            },
            {
              "month": "1404-05",
              "value": 150
            },
            {
              "month": "1404-06",
              "value": 167
            },
            {
              "month": "1404-07",
              "value": 222
            },
            {
              "month": "1404-08",
              "value": 261
            },
            {
              "month": "1404-09",
              "value": 301
            },
            {
              "month": "1404-10",
              "value": 316
            },
            {
              "month": "1404-11",
              "value": 313
            },
            {
              "month": "1404-12",
              "value": 311
            },
            {
              "month": "1405-01",
              "value": 309
            },
            {
              "month": "1405-02",
              "value": 305
            },
            {
              "month": "1405-03",
              "value": 370
            }
          ]
        }
      },
      "bale": {
        "fasle_11": {
          "handle": "fasle_11",
          "series": [
            {
              "month": "1404-02",
              "value": 42
            },
            {
              "month": "1404-03",
              "value": 65
            },
            {
              "month": "1404-04",
              "value": 66
            },
            {
              "month": "1404-05",
              "value": 71
            },
            {
              "month": "1404-06",
              "value": 74
            },
            {
              "month": "1404-07",
              "value": 82
            },
            {
              "month": "1404-08",
              "value": 85
            },
            {
              "month": "1404-09",
              "value": 85
            },
            {
              "month": "1404-10",
              "value": 90
            },
            {
              "month": "1404-11",
              "value": 91
            },
            {
              "month": "1404-12",
              "value": 93
            },
            {
              "month": "1405-01",
              "value": 102
            },
            {
              "month": "1405-02",
              "value": 109
            },
            {
              "month": "1405-03",
              "value": 152
            }
          ]
        }
      },
      "eita": {
        "fasle_11": {
          "handle": "fasle_11",
          "series": [
            {
              "month": "1404-02",
              "value": 76
            },
            {
              "month": "1404-03",
              "value": 96
            },
            {
              "month": "1404-04",
              "value": 100
            },
            {
              "month": "1404-05",
              "value": 182
            },
            {
              "month": "1404-06",
              "value": 177
            },
            {
              "month": "1404-07",
              "value": 248
            },
            {
              "month": "1404-08",
              "value": 254
            },
            {
              "month": "1404-09",
              "value": 260
            },
            {
              "month": "1404-10",
              "value": 269
            },
            {
              "month": "1404-11",
              "value": 263
            },
            {
              "month": "1404-12",
              "value": 268
            },
            {
              "month": "1405-01",
              "value": 338
            },
            {
              "month": "1405-02",
              "value": 347
            },
            {
              "month": "1405-03",
              "value": 364
            }
          ]
        }
      },
      "youtube": {
        "fasle_11": {
          "handle": "fasle_11",
          "series": [
            {
              "month": "1404-09",
              "value": 237
            },
            {
              "month": "1404-10",
              "value": 246
            },
            {
              "month": "1404-11",
              "value": 249
            },
            {
              "month": "1404-12",
              "value": 250
            },
            {
              "month": "1405-01",
              "value": 250
            },
            {
              "month": "1405-02",
              "value": 250
            },
            {
              "month": "1405-03",
              "value": 350
            }
          ]
        }
      }
    }
  },
  {
    "name": "سینه فیلیا",
    "platforms": {
      "youtube": {
        "cinephilia.hastim": {
          "handle": "cinephilia.hastim",
          "series": [
            {
              "month": "1404-06",
              "value": 14
            },
            {
              "month": "1404-07",
              "value": 50
            },
            {
              "month": "1404-08",
              "value": 70
            }
          ]
        },
        "cine.philiaoffical": {
          "handle": "cine.philiaoffical",
          "series": [
            {
              "month": "1404-09",
              "value": 100
            },
            {
              "month": "1404-10",
              "value": 134
            },
            {
              "month": "1404-11",
              "value": 160
            },
            {
              "month": "1404-12",
              "value": 161
            },
            {
              "month": "1405-01",
              "value": 161
            },
            {
              "month": "1405-02",
              "value": 161
            },
            {
              "month": "1405-03",
              "value": 178
            }
          ]
        }
      },
      "instagram": {
        "cine.philiaoffical": {
          "handle": "cine.philiaoffical",
          "series": [
            {
              "month": "1404-06",
              "value": 19
            },
            {
              "month": "1404-07",
              "value": 1007
            },
            {
              "month": "1404-08",
              "value": 1081
            },
            {
              "month": "1404-09",
              "value": 1091
            },
            {
              "month": "1404-10",
              "value": 1144
            },
            {
              "month": "1404-11",
              "value": 1939
            },
            {
              "month": "1404-12",
              "value": 1952
            },
            {
              "month": "1405-01",
              "value": 1982
            },
            {
              "month": "1405-02",
              "value": 1994
            },
            {
              "month": "1405-03",
              "value": 2135
            }
          ]
        }
      },
      "telegram": {
        "cinephiliaoffical": {
          "handle": "cinephiliaoffical",
          "series": [
            {
              "month": "1404-06",
              "value": 48
            },
            {
              "month": "1404-07",
              "value": 61
            },
            {
              "month": "1404-08",
              "value": 61
            }
          ]
        },
        "cine.philiaoffical": {
          "handle": "cine.philiaoffical",
          "series": [
            {
              "month": "1404-09",
              "value": 63
            },
            {
              "month": "1404-10",
              "value": 63
            },
            {
              "month": "1404-11",
              "value": 68
            },
            {
              "month": "1404-12",
              "value": 67
            },
            {
              "month": "1405-01",
              "value": 67
            },
            {
              "month": "1405-02",
              "value": 67
            },
            {
              "month": "1405-03",
              "value": 64
            }
          ]
        }
      },
      "rubika": {
        "cine.philiaoffical": {
          "handle": "cine.philiaoffical",
          "series": [
            {
              "month": "1404-10",
              "value": 3
            },
            {
              "month": "1404-11",
              "value": 3
            },
            {
              "month": "1404-12",
              "value": 5
            },
            {
              "month": "1405-01",
              "value": 5
            },
            {
              "month": "1405-02",
              "value": 5
            },
            {
              "month": "1405-03",
              "value": 5
            }
          ]
        }
      },
      "bale": {
        "cine.philiaoffical": {
          "handle": "cine.philiaoffical",
          "series": [
            {
              "month": "1404-10",
              "value": 3
            },
            {
              "month": "1404-11",
              "value": 3
            },
            {
              "month": "1404-12",
              "value": 5
            },
            {
              "month": "1405-01",
              "value": 5
            },
            {
              "month": "1405-02",
              "value": 5
            },
            {
              "month": "1405-03",
              "value": 5
            }
          ]
        }
      },
      "eita": {
        "cine.philiaoffical": {
          "handle": "cine.philiaoffical",
          "series": [
            {
              "month": "1404-10",
              "value": 3
            },
            {
              "month": "1404-11",
              "value": 3
            },
            {
              "month": "1404-12",
              "value": 3
            },
            {
              "month": "1405-01",
              "value": 3
            },
            {
              "month": "1405-02",
              "value": 3
            },
            {
              "month": "1405-03",
              "value": 3
            }
          ]
        }
      }
    }
  },
  {
    "name": "مردمک",
    "platforms": {
      "instagram": {
        "MARDOMAKMEDIA": {
          "handle": "MARDOMAKMEDIA",
          "series": [
            {
              "month": "1404-09",
              "value": 6450
            },
            {
              "month": "1404-12",
              "value": 16800
            },
            {
              "month": "1405-01",
              "value": 17000
            },
            {
              "month": "1405-03",
              "value": 23700
            }
          ]
        },
        "mardomakmedia": {
          "handle": "mardomakmedia",
          "series": [
            {
              "month": "1404-10",
              "value": 14731
            },
            {
              "month": "1404-11",
              "value": 15500
            }
          ]
        }
      },
      "bale": {
        "MARDOMAKMEDIA": {
          "handle": "MARDOMAKMEDIA",
          "series": [
            {
              "month": "1405-01",
              "value": 592
            }
          ]
        }
      }
    }
  },
  {
    "name": "صد درجه",
    "platforms": {
      "instagram": {
        "darajee100": {
          "handle": "darajee100",
          "series": [
            {
              "month": "1405-01",
              "value": 69
            },
            {
              "month": "1405-02",
              "value": 153
            },
            {
              "month": "1405-03",
              "value": 3835
            }
          ]
        }
      },
      "youtube": {
        "darajee100": {
          "handle": "darajee100",
          "series": [
            {
              "month": "1405-01",
              "value": 6
            },
            {
              "month": "1405-02",
              "value": 22
            },
            {
              "month": "1405-03",
              "value": 126
            }
          ]
        }
      },
      "telegram": {
        "darajee100": {
          "handle": "darajee100",
          "series": [
            {
              "month": "1405-01",
              "value": 14
            },
            {
              "month": "1405-02",
              "value": 18
            },
            {
              "month": "1405-03",
              "value": 49
            }
          ]
        }
      },
      "bale": {
        "darajee100": {
          "handle": "darajee100",
          "series": [
            {
              "month": "1405-01",
              "value": 8
            },
            {
              "month": "1405-02",
              "value": 9
            },
            {
              "month": "1405-03",
              "value": 152
            }
          ]
        }
      },
      "rubika": {
        "darajee100": {
          "handle": "darajee100",
          "series": [
            {
              "month": "1405-01",
              "value": 15
            },
            {
              "month": "1405-02",
              "value": 17
            },
            {
              "month": "1405-03",
              "value": 20
            }
          ]
        }
      }
    }
  },
  {
    "name": "رهبر سوم",
    "platforms": {
      "instagram": {
        "rahbar_sevvom": {
          "handle": "rahbar_sevvom",
          "series": [
            {
              "month": "1405-02",
              "value": 22657
            }
          ]
        }
      },
      "telegram": {
        "rahbar_sevvom": {
          "handle": "rahbar_sevvom",
          "series": [
            {
              "month": "1405-02",
              "value": 20
            }
          ]
        }
      },
      "eita": {
        "rahbar_sevvom": {
          "handle": "rahbar_sevvom",
          "series": [
            {
              "month": "1405-02",
              "value": 81
            }
          ]
        }
      },
      "bale": {
        "rahbar_sevvom": {
          "handle": "rahbar_sevvom",
          "series": [
            {
              "month": "1405-02",
              "value": 18
            }
          ]
        }
      },
      "rubika": {
        "rahbar_sevvom": {
          "handle": "rahbar_sevvom",
          "series": [
            {
              "month": "1405-02",
              "value": 10
            }
          ]
        }
      }
    }
  }
];
