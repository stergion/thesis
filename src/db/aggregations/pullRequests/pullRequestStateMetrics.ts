import { PartialWithUserIdContributionDoc, PullRequestDoc } from "../../../models/models.js";
import { match, merge, topN } from "../customStages.js";


type DateUnit = "day" | "week" | "month" | "year";

interface SetWindowFieldsOptions {
  range?: {
    start?: number,
  },
  unit?: DateUnit;
}

function dailyStateCount(options?: SetWindowFieldsOptions): Object[] {
  const {
    range = { start: -1 },
    unit = "year"
  }: SetWindowFieldsOptions = options ?? {};

  const date = "$createdAt";

  const get_state = (state: PullRequestDoc["state"]) => (
    {
      "$sum": {
        "$cond": {
          "if": {
            "$eq": [
              "$state", state
            ]
          },
          "then": 1,
          "else": 0
        }
      },
    }
  );

  return [
    // Group State Count by Day
    {
      "$group": {
        "_id": {
          "year": {
            "$year": date
          },
          "dayOfYear": {
            "$dayOfYear": date
          }
        },
        "total": {
          "$count": {}
        },
        "open": get_state("OPEN"),
        "closed": get_state("CLOSED"),
        "merged": get_state("MERGED"),
      }
    },

    //  date: dateFromParts 
    {
      "$set": {
        "_id": "$$REMOVE",
        "date": {
          "$dateFromParts": {
            "year": "$_id.year",
            "day": "$_id.dayOfYear"
          }
        }
      }
    },

    // Cumulative Count of State 
    /* {
      "$setWindowFields": {
        "sortBy": {
          "date": 1
        },
        "output": {
          "total": {
            "$sum": "$total",
            "window": {
              "range": [
                "unbounded", "current"
              ],
              "unit": "year"
            }
          },
          "open": {
            "$sum": "$open",
            "window": {
              "range": [
                "unbounded", "current"
              ],
              "unit": "year"
            }
          },
          "closed": {
            "$sum": "$closed",
            "window": {
              "range": [
                "unbounded", "current"
              ],
              "unit": "year"
            }
          },
          "merged": {
            "$sum": "$merged",
            "window": {
              "range": [
                "unbounded", "current"
              ],
              "unit": "year"
            }
          }
        }
      }
    }, */
    {
      "$sort": {
        "date": - 1
      }
    }
  ];
}

function reshapeResults() {
  return [
    {
      // Create Array of State Values and Array of Dates
      "$group": {
        "_id": null,
        "date": {
          "$push": "$date"
        },
        "total": {
          "$push": "$total"
        },
        "open": {
          "$push": "$open"
        },
        "closed": {
          "$push": "$closed"
        },
        "merged": {
          "$push": "$merged"
        }
      }
    },
    {
      "$unset": "_id"
    },

    // Add Arrays to Wrapper Object
    {
      "$project": {
        "cumulative_pr_state": "$$CURRENT"
      }
    },
  ];
}

export default (
  filter: PartialWithUserIdContributionDoc,
  options?: { merge?: boolean; }
) => Array.prototype.concat(
  match(filter),
  dailyStateCount(),
  // topN<PullRequestDoc>({ date: -1 }, 100)
  reshapeResults(),
  merge(filter, "pullRequests", options?.merge ?? true)
);