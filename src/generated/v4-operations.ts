/**
 * Generated from the official solved.ac v4 OpenAPI snapshot plus the
 * snapshot-bound reviewed gateway request supplement.
 * Snapshot SHA-256: 312abfb4677fc67d914f6a357ff5b89d170eb65791ecb5d3ab30ab873352125d
 * Do not edit directly; run npm run openapi:operations:update.
 */
import type { V4OperationManifest } from '../domain/v4-operation-contract.js';

export const V4_OPERATION_SNAPSHOT_SHA256 = "312abfb4677fc67d914f6a357ff5b89d170eb65791ecb5d3ab30ab873352125d" as const;

export const V4_OPERATION_MANIFEST = {
  "DELETE /api/v4/account/bookmark-favorites/{handle}/{slug}": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmark-favorites/{handle}/{slug}",
    "method": "DELETE",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmark-favorites/{handle}/{slug}"
  },
  "DELETE /api/v4/account/bookmarks/{slug}": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks/{slug}",
    "method": "DELETE",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "204": {
        "mediaTypes": [],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks/{slug}"
  },
  "GET /api/v4/account/backgrounds": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "collection"
    },
    "gatewayPath": "/solved/v4/account/backgrounds",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/backgrounds"
  },
  "GET /api/v4/account/bans": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "standing"
    },
    "gatewayPath": "/solved/v4/account/bans",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bans"
  },
  "GET /api/v4/account/bookmark-favorites": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks"
    },
    "gatewayPath": "/solved/v4/account/bookmark-favorites",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "maximum": 10000,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmark-favorites"
  },
  "GET /api/v4/account/bookmarks": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks"
    },
    "gatewayPath": "/solved/v4/account/bookmarks",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "problemId",
          "required": false,
          "schema": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks"
  },
  "GET /api/v4/account/collection": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "collection"
    },
    "gatewayPath": "/solved/v4/account/collection",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "category",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "kind",
          "required": false,
          "schema": {
            "annotationDefault": "badge",
            "enum": [
              "badge",
              "background"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "offset",
          "required": false,
          "schema": {
            "annotationDefault": 0,
            "kind": "integer",
            "minimum": 0,
            "nullable": true
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "recent",
            "enum": [
              "recent",
              "rarity",
              "name"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/collection"
  },
  "GET /api/v4/account/consents": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "profile"
    },
    "gatewayPath": "/solved/v4/account/consents",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/consents"
  },
  "GET /api/v4/account/items": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "collection"
    },
    "gatewayPath": "/solved/v4/account/items",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/items"
  },
  "GET /api/v4/account/profile": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "profile.personal"
    },
    "gatewayPath": "/solved/v4/account/profile",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/profile"
  },
  "GET /api/v4/account/settings": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "settings"
    },
    "gatewayPath": "/solved/v4/account/settings",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/settings"
  },
  "GET /api/v4/account/standing": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "standing"
    },
    "gatewayPath": "/solved/v4/account/standing",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/standing"
  },
  "GET /api/v4/account/wallet": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "wallet"
    },
    "gatewayPath": "/solved/v4/account/wallet",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/wallet"
  },
  "GET /api/v4/account/wallet/history": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "wallet"
    },
    "gatewayPath": "/solved/v4/account/wallet/history",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "month",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^\\d{4}-(0[1-9]|1[0-2])$"
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/wallet/history"
  },
  "GET /api/v4/achievements": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/achievements",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/achievements"
  },
  "GET /api/v4/achievements/for-problem/{problemId}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/achievements/for-problem/{problemId}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/achievements/for-problem/{problemId}"
  },
  "GET /api/v4/achievements/items/{kind}/{key}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/achievements/items/{kind}/{key}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "key",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "kind",
          "required": true,
          "schema": {
            "enum": [
              "badge",
              "background"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/achievements/items/{kind}/{key}"
  },
  "GET /api/v4/achievements/items/{kind}/{key}/holders": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/achievements/items/{kind}/{key}/holders",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "key",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "kind",
          "required": true,
          "schema": {
            "enum": [
              "badge",
              "background"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "maximum": 200,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "recent",
            "enum": [
              "recent",
              "first"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/achievements/items/{kind}/{key}/holders"
  },
  "GET /api/v4/affiliations/{id}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/affiliations/{id}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "id",
          "required": true,
          "schema": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/affiliations/{id}"
  },
  "GET /api/v4/bookmarks": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/bookmarks",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "maximum": 10000,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 100,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "updated",
            "enum": [
              "updated",
              "problems"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/bookmarks"
  },
  "GET /api/v4/health": {
    "access": {
      "bearer": "none",
      "class": "open"
    },
    "gatewayPath": "/solved/v4/health",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/health"
  },
  "GET /api/v4/help/{slug}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/help/{slug}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 128,
            "minLength": 1,
            "nullable": false,
            "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/help/{slug}"
  },
  "GET /api/v4/me": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "profile"
    },
    "gatewayPath": "/solved/v4/me",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/me"
  },
  "GET /api/v4/me/emoticons": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "collection"
    },
    "gatewayPath": "/solved/v4/me/emoticons",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/me/emoticons"
  },
  "GET /api/v4/me/tag-progress": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "solves"
    },
    "gatewayPath": "/solved/v4/me/tag-progress",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/me/tag-progress"
  },
  "GET /api/v4/policies/{slug}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/policies/{slug}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "enum": [
              "tos",
              "tos_recurring",
              "privacy",
              "chrome_privacy",
              "guideline",
              "rules",
              "developer_terms",
              "partner_terms"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/policies/{slug}"
  },
  "GET /api/v4/policies/{slug}/{ref}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/policies/{slug}/{ref}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "ref",
          "required": true,
          "schema": {
            "kind": "anyOf",
            "nullable": false,
            "options": [
              {
                "kind": "string",
                "nullable": false,
                "pattern": "^(v\\d{1,3}|beta)$"
              },
              {
                "kind": "string",
                "nullable": false,
                "pattern": "^\\d{8}$"
              }
            ]
          },
          "sourceRequired": true
        },
        {
          "name": "slug",
          "required": true,
          "schema": {
            "enum": [
              "tos",
              "tos_recurring",
              "privacy",
              "chrome_privacy",
              "guideline",
              "rules",
              "developer_terms",
              "partner_terms"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/policies/{slug}/{ref}"
  },
  "GET /api/v4/posts/help": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/posts/help",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/posts/help"
  },
  "GET /api/v4/posts/help/page": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/posts/help/page",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "path",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 255,
            "minLength": 1,
            "nullable": false,
            "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*(?:\\/[a-z0-9]+(?:-[a-z0-9]+)*)*$"
          },
          "sourceRequired": true
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/posts/help/page"
  },
  "GET /api/v4/posts/notice": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/posts/notice",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "maximum": 10000,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/posts/notice"
  },
  "GET /api/v4/posts/notice/{slug}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/posts/notice/{slug}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false,
            "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/posts/notice/{slug}"
  },
  "GET /api/v4/problems": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/problems",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "direction",
          "required": false,
          "schema": {
            "annotationDefault": "asc",
            "enum": [
              "asc",
              "desc"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "seed",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "id",
            "enum": [
              "id",
              "level",
              "solved",
              "average_try",
              "random"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/problems"
  },
  "GET /api/v4/problems/{problemId}": {
    "access": {
      "bearer": "optional",
      "class": "public",
      "scope": "solves"
    },
    "gatewayPath": "/solved/v4/problems/{problemId}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "sub",
          "required": false,
          "schema": {
            "annotationDefault": "",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/problems/{problemId}"
  },
  "GET /api/v4/problems/{problemId}/reports": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/problems/{problemId}/reports",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sub",
          "required": false,
          "schema": {
            "annotationDefault": "",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/problems/{problemId}/reports"
  },
  "GET /api/v4/problems/{problemId}/votes": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/problems/{problemId}/votes",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "recent",
            "enum": [
              "recent",
              "level",
              "weight"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sub",
          "required": false,
          "schema": {
            "annotationDefault": "",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/problems/{problemId}/votes"
  },
  "GET /api/v4/problems/{problemId}/votes/me": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "votes"
    },
    "gatewayPath": "/solved/v4/problems/{problemId}/votes/me",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "sub",
          "required": false,
          "schema": {
            "annotationDefault": "",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/problems/{problemId}/votes/me"
  },
  "GET /api/v4/problems/{problemId}/votes/summary": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/problems/{problemId}/votes/summary",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "sub",
          "required": false,
          "schema": {
            "annotationDefault": "",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/problems/{problemId}/votes/summary"
  },
  "GET /api/v4/rankings/affiliation-board": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/affiliation-board",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "type",
          "required": false,
          "schema": {
            "enum": [
              "undefined",
              "university",
              "high_school",
              "middle_school",
              "elementary_school",
              "company",
              "community"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/affiliation-board"
  },
  "GET /api/v4/rankings/affiliations": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/affiliations",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/affiliations"
  },
  "GET /api/v4/rankings/affiliations/{affiliationId}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/affiliations/{affiliationId}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "gatewayOverride": "required-non-null-path",
          "name": "affiliationId",
          "required": true,
          "schema": {
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": false
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/affiliations/{affiliationId}"
  },
  "GET /api/v4/rankings/regions": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/regions",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/regions"
  },
  "GET /api/v4/rankings/regions/{countryCode}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/regions/{countryCode}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "countryCode",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 2,
            "minLength": 2,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/regions/{countryCode}"
  },
  "GET /api/v4/rankings/reverse-rivals": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "rivals"
    },
    "gatewayPath": "/solved/v4/rankings/reverse-rivals",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/reverse-rivals"
  },
  "GET /api/v4/rankings/rivals": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "rivals"
    },
    "gatewayPath": "/solved/v4/rankings/rivals",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/rivals"
  },
  "GET /api/v4/rankings/tags": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/tags",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/tags"
  },
  "GET /api/v4/rankings/tags/{key}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/tags/{key}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "key",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/tags/{key}"
  },
  "GET /api/v4/rankings/users": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/users",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "rating",
            "enum": [
              "rating",
              "solved",
              "contribution"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/users"
  },
  "GET /api/v4/rankings/users/search": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/rankings/users/search",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "q",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "rating",
            "enum": [
              "rating",
              "solved",
              "contribution"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/rankings/users/search"
  },
  "GET /api/v4/search/analyze": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/search/analyze",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 1000,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/search/analyze"
  },
  "GET /api/v4/search/random-problem": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/search/random-problem",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 1000,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/search/random-problem"
  },
  "GET /api/v4/search/suggest": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/search/suggest",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": [
        {
          "name": "topic",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "value",
          "required": false,
          "schema": {
            "annotationDefault": "",
            "kind": "string",
            "maxLength": 100,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/search/suggest"
  },
  "GET /api/v4/site/stats": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/site/stats",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/site/stats"
  },
  "GET /api/v4/sources": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/sources",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/sources"
  },
  "GET /api/v4/sources/contests/{id}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/sources/contests/{id}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "id",
          "required": true,
          "schema": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/sources/contests/{id}"
  },
  "GET /api/v4/sources/groups/{id}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/sources/groups/{id}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "id",
          "required": true,
          "schema": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/sources/groups/{id}"
  },
  "GET /api/v4/sources/oj/{ojId}/contests/{nativeId}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/sources/oj/{ojId}/contests/{nativeId}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "nativeId",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "ojId",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 32,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/sources/oj/{ojId}/contests/{nativeId}"
  },
  "GET /api/v4/sources/oj/{ojId}/groups/{nativeId}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/sources/oj/{ojId}/groups/{nativeId}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "nativeId",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "ojId",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 32,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/sources/oj/{ojId}/groups/{nativeId}"
  },
  "GET /api/v4/tags": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/tags",
    "method": "GET",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/tags"
  },
  "GET /api/v4/tags/{key}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/tags/{key}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "key",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/tags/{key}"
  },
  "GET /api/v4/users/{handle}": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}"
  },
  "GET /api/v4/users/{handle}/achievements": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/achievements",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "vs",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/achievements"
  },
  "GET /api/v4/users/{handle}/achievements/summary": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/achievements/summary",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/achievements/summary"
  },
  "GET /api/v4/users/{handle}/activity/days": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/activity/days",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "from",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "sourceRequired": true
        },
        {
          "name": "to",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "sourceRequired": true
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "400": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/activity/days"
  },
  "GET /api/v4/users/{handle}/activity/feed": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/activity/feed",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "before",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "from",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "sourceRequired": false
        },
        {
          "name": "limit",
          "required": false,
          "schema": {
            "kind": "integer",
            "maximum": 500,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "to",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/activity/feed"
  },
  "GET /api/v4/users/{handle}/badge-stand": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/badge-stand",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/badge-stand"
  },
  "GET /api/v4/users/{handle}/bookmarks": {
    "access": {
      "bearer": "optional",
      "class": "public",
      "scope": "bookmarks"
    },
    "gatewayPath": "/solved/v4/users/{handle}/bookmarks",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "maximum": 10000,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/bookmarks"
  },
  "GET /api/v4/users/{handle}/bookmarks/{slug}": {
    "access": {
      "bearer": "optional",
      "class": "public",
      "scope": "bookmarks"
    },
    "gatewayPath": "/solved/v4/users/{handle}/bookmarks/{slug}",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "direction",
          "required": false,
          "schema": {
            "annotationDefault": "asc",
            "enum": [
              "asc",
              "desc"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "page",
          "required": false,
          "schema": {
            "annotationDefault": 1,
            "kind": "integer",
            "maximum": 10000,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 512,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "order",
            "enum": [
              "order",
              "level",
              "solved",
              "average_try",
              "id"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/bookmarks/{slug}"
  },
  "GET /api/v4/users/{handle}/collection": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/collection",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "category",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "kind",
          "required": false,
          "schema": {
            "annotationDefault": "badge",
            "enum": [
              "badge",
              "background"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "lang",
          "required": false,
          "schema": {
            "annotationDefault": "ko",
            "kind": "string",
            "maxLength": 16,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "offset",
          "required": false,
          "schema": {
            "annotationDefault": 0,
            "kind": "integer",
            "minimum": 0,
            "nullable": true
          },
          "sourceRequired": false
        },
        {
          "name": "q",
          "required": false,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "annotationDefault": "recent",
            "enum": [
              "recent",
              "rarity",
              "name"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/collection"
  },
  "GET /api/v4/users/{handle}/contributions": {
    "access": {
      "bearer": "optional",
      "class": "public",
      "scope": "votes"
    },
    "gatewayPath": "/solved/v4/users/{handle}/contributions",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "commented",
          "required": false,
          "schema": {
            "enum": [
              "true",
              "false"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "limit",
          "required": false,
          "schema": {
            "kind": "integer",
            "maximum": 20,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "only",
          "required": false,
          "schema": {
            "enum": [
              "scoring",
              "helpful",
              "vouched"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "page",
          "required": false,
          "schema": {
            "kind": "integer",
            "maximum": 10000,
            "minimum": 1,
            "nullable": false
          },
          "sourceRequired": false
        },
        {
          "name": "sort",
          "required": false,
          "schema": {
            "enum": [
              "recent",
              "helpful"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/contributions"
  },
  "GET /api/v4/users/{handle}/rating/history": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/rating/history",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "range",
          "required": false,
          "schema": {
            "enum": [
              "90d",
              "1y",
              "all"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/rating/history"
  },
  "GET /api/v4/users/{handle}/reputation": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/reputation",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "range",
          "required": false,
          "schema": {
            "enum": [
              "90d",
              "1y",
              "all"
            ],
            "kind": "string",
            "nullable": false
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/reputation"
  },
  "GET /api/v4/users/{handle}/reputation/log": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/reputation/log",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": [
        {
          "name": "month",
          "required": false,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^\\d{4}-(0[1-9]|1[0-2])$"
          },
          "sourceRequired": false
        }
      ]
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/reputation/log"
  },
  "GET /api/v4/users/{handle}/tags/{key}/histogram": {
    "access": {
      "bearer": "none",
      "class": "public"
    },
    "gatewayPath": "/solved/v4/users/{handle}/tags/{key}/histogram",
    "method": "GET",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "key",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/users/{handle}/tags/{key}/histogram"
  },
  "PATCH /api/v4/account/bookmarks/{slug}": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks/{slug}",
    "method": "PATCH",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "color": {
            "enum": [
              "red",
              "violet",
              "blue",
              "teal",
              "lime",
              "yellow",
              "orange",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "description": {
            "kind": "string",
            "maxLength": 2048,
            "nullable": false
          },
          "name": {
            "kind": "string",
            "maxLength": 256,
            "minLength": 1,
            "nullable": false
          },
          "slug": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "visibility": {
            "enum": [
              "private",
              "unlisted",
              "public"
            ],
            "kind": "string",
            "nullable": false
          }
        },
        "required": [],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "409": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks/{slug}"
  },
  "PATCH /api/v4/account/bookmarks/{slug}/problems/{problemId}": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks/{slug}/problems/{problemId}",
    "method": "PATCH",
    "parameters": {
      "path": [
        {
          "name": "problemId",
          "required": true,
          "schema": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "after": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": false
          },
          "before": {
            "exclusiveMinimum": 0,
            "kind": "integer",
            "nullable": true
          },
          "note": {
            "kind": "string",
            "maxLength": 2048,
            "nullable": true
          }
        },
        "required": [],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks/{slug}/problems/{problemId}"
  },
  "PATCH /api/v4/account/settings": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "settings.write"
    },
    "gatewayPath": "/solved/v4/account/settings",
    "method": "PATCH",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "alwaysShowUnratable": {
            "kind": "boolean",
            "nullable": true
          },
          "alwaysShowUnrated": {
            "kind": "boolean",
            "nullable": true
          },
          "iconSchemeHover": {
            "enum": [
              "show",
              "warn",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "iconSchemeSolved": {
            "enum": [
              "show",
              "warn",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "iconSchemeUnsolved": {
            "enum": [
              "show",
              "warn",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "iconTheme": {
            "enum": [
              "default",
              "legacy",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "iconWarnAbsolute": {
            "kind": "integer",
            "maximum": 30,
            "minimum": 0,
            "nullable": true
          },
          "iconWarnMode": {
            "enum": [
              "relative",
              "absolute",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "iconWarnRelative": {
            "kind": "integer",
            "maximum": 30,
            "minimum": -30,
            "nullable": true
          },
          "problemSort": {
            "enum": [
              "id",
              "level",
              "solved",
              "average_try",
              "random",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "problemSortDirection": {
            "enum": [
              "asc",
              "desc",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "showOriginalContest": {
            "kind": "boolean",
            "nullable": true
          },
          "showOriginalTitle": {
            "kind": "boolean",
            "nullable": true
          },
          "showSolvedUserCount": {
            "enum": [
              "show",
              "solved-only",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "showTagButton": {
            "enum": [
              "show",
              "solved-only",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "showVotedUserCount": {
            "enum": [
              "show",
              "solved-only",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceLevelAllSolved": {
            "enum": [
              "show",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceLevelDisplay": {
            "enum": [
              "dots",
              "gradient",
              "none",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceLevelHover": {
            "enum": [
              "show",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceLevelPartlySolved": {
            "enum": [
              "show",
              "partial-if-ascending",
              "partial",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceLevelUnsolved": {
            "enum": [
              "show",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceOrderHover": {
            "enum": [
              "show",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceOrderType": {
            "enum": [
              "show",
              "partly-solved",
              "all-solved",
              "hide",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceSort": {
            "enum": [
              "default",
              "name",
              "size",
              "p25",
              "p50",
              "p75",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "sourceSortDirection": {
            "enum": [
              "asc",
              "desc",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "tagDisplayLanguage": {
            "enum": [
              "identifier",
              "ko",
              "en",
              "ja",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "theme": {
            "enum": [
              "system",
              "light",
              "dark",
              null
            ],
            "kind": "string",
            "nullable": true
          }
        },
        "required": [],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/settings"
  },
  "POST /api/v4/account/bookmark-favorites/{handle}/{slug}": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmark-favorites/{handle}/{slug}",
    "method": "POST",
    "parameters": {
      "path": [
        {
          "name": "handle",
          "required": true,
          "schema": {
            "kind": "string",
            "maxLength": 64,
            "minLength": 1,
            "nullable": false
          },
          "sourceRequired": true
        },
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": null,
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmark-favorites/{handle}/{slug}"
  },
  "POST /api/v4/account/bookmarks": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks",
    "method": "POST",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "color": {
            "annotationDefault": null,
            "enum": [
              "red",
              "violet",
              "blue",
              "teal",
              "lime",
              "yellow",
              "orange",
              null
            ],
            "kind": "string",
            "nullable": true
          },
          "description": {
            "annotationDefault": "",
            "kind": "string",
            "maxLength": 2048,
            "nullable": false
          },
          "name": {
            "kind": "string",
            "maxLength": 256,
            "minLength": 1,
            "nullable": false
          },
          "slug": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "visibility": {
            "annotationDefault": "private",
            "enum": [
              "private",
              "unlisted",
              "public"
            ],
            "kind": "string",
            "nullable": false
          }
        },
        "required": [
          "name",
          "slug"
        ],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "201": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "409": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "422": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks"
  },
  "POST /api/v4/account/bookmarks/order": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks/order",
    "method": "POST",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "slugs": {
            "items": {
              "kind": "string",
              "nullable": false,
              "pattern": "^[0-9a-z_]{1,32}$"
            },
            "kind": "array",
            "maxItems": 20,
            "minItems": 1,
            "nullable": false
          }
        },
        "required": [
          "slugs"
        ],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "204": {
        "mediaTypes": [],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "409": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks/order"
  },
  "POST /api/v4/account/bookmarks/{slug}/problems": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks/{slug}/problems",
    "method": "POST",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "problemIds": {
            "items": {
              "exclusiveMinimum": 0,
              "kind": "integer",
              "nullable": false
            },
            "kind": "array",
            "maxItems": 100,
            "minItems": 1,
            "nullable": false
          }
        },
        "required": [
          "problemIds"
        ],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "422": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks/{slug}/problems"
  },
  "POST /api/v4/account/bookmarks/{slug}/problems/remove": {
    "access": {
      "bearer": "required",
      "class": "user",
      "scope": "bookmarks.write"
    },
    "gatewayPath": "/solved/v4/account/bookmarks/{slug}/problems/remove",
    "method": "POST",
    "parameters": {
      "path": [
        {
          "name": "slug",
          "required": true,
          "schema": {
            "kind": "string",
            "nullable": false,
            "pattern": "^[0-9a-z_]{1,32}$"
          },
          "sourceRequired": true
        }
      ],
      "query": []
    },
    "requestBody": {
      "declaredRequired": false,
      "effectiveRequired": true,
      "mediaType": "application/json",
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "problemIds": {
            "items": {
              "exclusiveMinimum": 0,
              "kind": "integer",
              "nullable": false
            },
            "kind": "array",
            "maxItems": 100,
            "minItems": 1,
            "nullable": false
          }
        },
        "required": [
          "problemIds"
        ],
        "unknownProperties": "reject"
      },
      "source": "openapi"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "403": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "access-global"
      },
      "404": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": true,
      "policy": "generated"
    },
    "upstreamPath": "/api/v4/account/bookmarks/{slug}/problems/remove"
  },
  "POST /api/v4/oauth/revoke": {
    "access": {
      "bearer": "none",
      "class": "app"
    },
    "gatewayPath": "/solved/v4/oauth/revoke",
    "method": "POST",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": {
      "canonicalMediaType": "application/x-www-form-urlencoded",
      "effectiveRequired": true,
      "mediaTypes": [
        "application/x-www-form-urlencoded"
      ],
      "schema": {
        "kind": "object",
        "nullable": false,
        "properties": {
          "token": {
            "kind": "string",
            "minLength": 1,
            "nullable": false
          }
        },
        "required": [
          "token"
        ],
        "unknownProperties": "reject"
      },
      "source": "gateway-supplement",
      "sourceDescriptionSha256": "15ed35b8d2cca48237a743a65e2db8aba2966ac89dc5ea8df9de4917761d95e1",
      "supplement": "oauth-revoke"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "400": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": false,
      "policy": "implementation-required",
      "requiredSecurity": {
        "appAuthentication": "server-owned-x-client-headers",
        "browserCors": "exact-origin",
        "callerAuthorization": "reject",
        "forwardEtag": false,
        "responseCache": "no-store",
        "responsePragma": "no-cache",
        "upstreamAttempts": 1
      },
      "supplement": "oauth-revoke"
    },
    "upstreamPath": "/api/v4/oauth/revoke"
  },
  "POST /api/v4/oauth/token": {
    "access": {
      "bearer": "none",
      "class": "app"
    },
    "gatewayPath": "/solved/v4/oauth/token",
    "method": "POST",
    "parameters": {
      "path": [],
      "query": []
    },
    "requestBody": {
      "canonicalMediaType": "application/x-www-form-urlencoded",
      "effectiveRequired": true,
      "mediaTypes": [
        "application/json",
        "application/x-www-form-urlencoded"
      ],
      "schema": {
        "kind": "oneOf",
        "nullable": false,
        "options": [
          {
            "kind": "object",
            "nullable": false,
            "properties": {
              "code": {
                "kind": "string",
                "minLength": 1,
                "nullable": false
              },
              "code_verifier": {
                "kind": "string",
                "maxLength": 128,
                "minLength": 43,
                "nullable": false,
                "pattern": "^[A-Za-z0-9._~-]{43,128}$"
              },
              "grant_type": {
                "enum": [
                  "authorization_code"
                ],
                "kind": "string",
                "nullable": false
              },
              "redirect_uri": {
                "kind": "string",
                "minLength": 1,
                "nullable": false
              }
            },
            "required": [
              "code",
              "code_verifier",
              "grant_type",
              "redirect_uri"
            ],
            "unknownProperties": "reject"
          },
          {
            "kind": "object",
            "nullable": false,
            "properties": {
              "grant_type": {
                "enum": [
                  "refresh_token"
                ],
                "kind": "string",
                "nullable": false
              },
              "refresh_token": {
                "kind": "string",
                "minLength": 1,
                "nullable": false
              },
              "scope": {
                "kind": "string",
                "minLength": 1,
                "nullable": false,
                "pattern": "^[\\x21\\x23-\\x5B\\x5D-\\x7E]+(?: [\\x21\\x23-\\x5B\\x5D-\\x7E]+)*$"
              }
            },
            "required": [
              "grant_type",
              "refresh_token"
            ],
            "unknownProperties": "reject"
          }
        ]
      },
      "source": "gateway-supplement",
      "sourceDescriptionSha256": "23370b8ad7f346040583efa6d933c5b3d9cbb5df87f7de2e71ff072065fd4201",
      "supplement": "oauth-token"
    },
    "responses": {
      "200": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "400": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "401": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [],
        "source": "openapi"
      },
      "429": {
        "mediaTypes": [
          "application/json"
        ],
        "requiredHeaders": [
          "retry-after"
        ],
        "source": "gateway-global"
      }
    },
    "runtime": {
      "enabled": false,
      "policy": "implementation-required",
      "requiredSecurity": {
        "appAuthentication": "server-owned-x-client-headers",
        "browserCors": "exact-origin",
        "callerAuthorization": "reject",
        "forwardEtag": false,
        "responseCache": "no-store",
        "responsePragma": "no-cache",
        "upstreamAttempts": 1
      },
      "supplement": "oauth-token"
    },
    "upstreamPath": "/api/v4/oauth/token"
  }
} as const satisfies V4OperationManifest;

export type GeneratedV4OperationKey = keyof typeof V4_OPERATION_MANIFEST;
