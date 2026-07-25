Your first API call
For your first Catalog API call, you’ll learn how to retrieve the catalog name and associated business.
Follow these steps:

1. Select a catalog. The CATALOG_ID variable will be used to run this request.
   Select catalog for API call
   Catalog_Products #3937777086530924
   ​
2. Below is an example API request for retrieving catalog name and business. Try making this call in GraphAPI Explorer.
   123
   curl -i -G \
    'https://graph.facebook.com/v25.0/3937777086530924?fields=id,name,product_count' \
    -d 'access_token=EAAdubyz1fPkBR7YC9Wa8xEnPtaYEoxlPZBnHvZAFrqZA18vpWxQwSXyt7c7WCDXhuX29MEOED3XHkffaUZCmG7iU45fE1JPqiHY0IothrYAtxTPnxnt5nJIkz4QPzSj1ZAZAczYSFaN2KTilQKZCblRZCvr9x07a8sVHE0oZAgAFmv0oSjL9dhJVaHbmWJFXXVD4qvAZDZD'
3. After the request successfully runs, you see the following response:
   12345
   {
   "name": "Product Catalog Name",
   "product_count": "<product_count>",
   "id": "<catalog_id>"
   }
   If everything looks good, proceed to the next step.

Create products
You can create products for your catalog in multiple ways, including using the Feed API or Batch API to make calls that add new products.
For this next API call, we’ll be using Batch API to create products. Once created, these products will be scheduled for upload to your catalog through a process known as an "ingestion session".
Follow these steps:

1. Select a catalog. The CATALOG_ID variable will be used to run this request.
   Select catalog for API call
   Catalog_Products #3937777086530924
   ​
2. Below is an example API request for creating products. Try making this call in GraphAPI Explorer.
   12345678910111213141516171819202122232425262728293031323334
   curl -i -X POST \
    'https://graph.facebook.com/v25.0/3937777086530924/items_batch' \
    -d 'item_type=PRODUCT_ITEM' \
    -d 'requests=[
   {
   "method": "CREATE",
   "data": {
   "id": "test_product_retailer_id_1",
   "title": "Product 1 Title",
   "description": "HTML <b>Description</b> of the Product 1",

3. After the request successfully runs, you should see the following response:
   12345
   {
   "handles": [
   "{HANDLE_ID}"
   ]
   }
   After running this request, it will schedule an ingestion session for adding the products to the catalog which may take some time. To monitor the progress of the ingestion session, copy the HANDLE_ID, and try making a call in GraphAPI Explorer.
   If everything looks good, proceed to the next step.

curl -i -X POST \
 'https://graph.facebook.com/v25.0/3937777086530924/items_batch' \
 -d 'item_type=PRODUCT_ITEM' \
 -d 'requests=[
{
"method": "CREATE",
"data": {
"id": "test_product_retailer_id_1",
"title": "Product 1 Title",
"description": "HTML <b>Description</b> of the Product 1",
"price": "100.4 USD",
"image_link": "image_url_for_product_1",
"link": "website_url_for_product_1",
"availability": "in stock",
"condition": "new",
"brand": "brand_name"
}
},
{
"method": "CREATE",
"data": {
"id": "test_product_retailer_id_2",
"title": "Product 2 Title",
"description": "HTML <b>Description</b> of the Product 2",
"price": "120.4 USD",
"image_link": "image_url_for_product_2",
"link": "website_url_for_product_2",
"availability": "in stock",
"condition": "new",
"brand": "brand_name_for_product_2"
}
}
]' \
 -d 'access_token=EAAdubyz1fPkBR7YC9Wa8xEnPtaYEoxlPZBnHvZAFrqZA18vpWxQwSXyt7c7WCDXhuX29MEOED3XHkffaUZCmG7iU45fE1JPqiHY0IothrYAtxTPnxnt5nJIkz4QPzSj1ZAZAczYSFaN2KTilQKZCblRZCvr9x07a8sVHE0oZAgAFmv0oSjL9dhJVaHbmWJFXXVD4qvAZDZD'

{
"handles": [
"{HANDLE_ID}"
]
}

Manage products
You can also fetch products in your catalog using Catalog API.
Follow these steps:

1. Select a catalog. The catalog ID will be used to run the request.
   Select catalog for API call
   Catalog_Products #3937777086530924
   ​
2. Below is an example API request for fetching products in your catalog. Try making this call in GraphAPI Explorer.
   12345
   curl -i -G \
    'https://graph.facebook.com/v25.0/3937777086530924/products' \
    -d 'filter={"name":{"i_contains":"title"}}' \
    -d 'fields=retailer_id,id,name,category,errors' \
    -d 'access_token=EAAdubyz1fPkBR7YC9Wa8xEnPtaYEoxlPZBnHvZAFrqZA18vpWxQwSXyt7c7WCDXhuX29MEOED3XHkffaUZCmG7iU45fE1JPqiHY0IothrYAtxTPnxnt5nJIkz4QPzSj1ZAZAczYSFaN2KTilQKZCblRZCvr9x07a8sVHE0oZAgAFmv0oSjL9dhJVaHbmWJFXXVD4qvAZDZD'
3. After the request successfully runs, you will see list of products in following format.
   12345678910111213141516171819202122
   {
   "data": [
   {
   "retailer_id": "test_product_retailer_id_2",
   "id": "<PRODUCT_ID>",
   "name": "Product 2 Title"
   },
   {
   "retailer_id": "test_product_retailer_id_1",
   "id": "<PRODUCT_ID>",

If you want to delete the products you created as part of this guide, try this example DELETE call in GraphAPI Explorer.
If you want to update your products, try this example UPDATE call in GraphAPI Explorer.
curl -i -G \
 'https://graph.facebook.com/v25.0/3937777086530924/products' \
 -d 'filter={"name":{"i_contains":"title"}}' \
 -d 'fields=retailer_id,id,name,category,errors' \
 -d 'access_token=EAAdubyz1fPkBR7YC9Wa8xEnPtaYEoxlPZBnHvZAFrqZA18vpWxQwSXyt7c7WCDXhuX29MEOED3XHkffaUZCmG7iU45fE1JPqiHY0IothrYAtxTPnxnt5nJIkz4QPzSj1ZAZAczYSFaN2KTilQKZCblRZCvr9x07a8sVHE0oZAgAFmv0oSjL9dhJVaHbmWJFXXVD4qvAZDZD'

{
"data": [
{
"retailer_id": "test_product_retailer_id_2",
"id": "<PRODUCT_ID>",
"name": "Product 2 Title"
},
{
"retailer_id": "test_product_retailer_id_1",
"id": "<PRODUCT_ID>",
"name": "Product 1 Title"
}
],
"paging": {
"cursors": {
"before": "<prev_page_cursor>",
"after": "<next_page_cursor>"
},
"next": "https://graph.intern.facebook.com/v22.0/{CATALOG_ID}/products?access_token={ACCESS_TOKEN}&fields=retailer_id,id,name,category,errors&filter={\"name\":{\"i_contains\":\"title\"}}&after={next_page_cursor}",
"previous": "https://graph.intern.facebook.com/v22.0/{CATALOG_ID}/products?access_token={ACCESS_TOKEN}&fields=retailer_id,id,name,category,errors&filter={\"name\":{\"i_contains\":\"title\"}}&after={prev_page_cursor}"
}
}

Parâmetros
JSON
Remover
item_type
PRODUCT_ITEM
Remover
requests
[
{
"method": "UPDATE",
"data": {
"id": "test_product_retailer_id_1",
"title": "New Product 1 Title",
"description": "New HTML <b>Description</b> of the Product 1",
"price": "100.4 USD",
"image_link": "image_url_for_product_1",
"link": "website_url_for_product_1",
"availability": "in stock",
"condition": "new",
"brand": "brand_name"
}
},
{
"method": "UPDATE",
"data": {
"id": "test_product_retailer_id_2",
"title": "New Product 2 Title",
"description": "New HTML <b>Description</b> of the Product 2",
"price": "120.4 USD",
"image_link": "image_url_for_product_2",
"link": "website_url_for_product_2",
"availability": "in stock",
"condition": "new",
"brand": "brand_name_for_product_2"
}
}
]

- Adicionar outro parâmetro
- {
  "item_type": "PRODUCT_ITEM",
  "requests": [
  {
  "method": "UPDATE",
  "data": {
  "id": "test_product_retailer_id_1",
  "title": "New Product 1 Title",
  "description": "New HTML <b>Description</b> of the Product 1",
  "price": "100.4 USD",
  "image_link": "image_url_for_product_1",
  "link": "website_url_for_product_1",
  "availability": "in stock",
  "condition": "new",
  "brand": "brand_name"
  }
  },
  {
  "method": "UPDATE",
  "data": {
  "id": "test_product_retailer_id_2",
  "title": "New Product 2 Title",
  "description": "New HTML <b>Description</b> of the Product 2",
  "price": "120.4 USD",
  "image_link": "image_url_for_product_2",
  "link": "website_url_for_product_2",
  "availability": "in stock",
  "condition": "new",
  "brand": "brand_name_for_product_2"
  }
  }
  ]
  }3937777086530924/items_batch

PRODUCT_ITEM
Remover
requests
[
{
"method": "DELETE",
"data": {
"id": "test_product_retailer_id_1"
}
},
{
"method": "DELETE",
"data": {
"id": "test_product_retailer_id_2"
}
}
]

# Catalog

A catalog is an object (or container) of information about your products and where you can upload your inventory. Learn more about [catalogs](https://developers.facebook.com/documentation/ads-commerce/catalog/overview).

## Common uses

- **[Collection Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/creative/collection-ads)** — Ads that let people discover, browse, and purchase products and services from a grid of images on a single screen.
- **[Commerce](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog)** — Distribute products in Marketplace.
- **[Advantage+ Catalog Ads](https://developers.facebook.com/docs/marketing-api/dynamic-ads)** — Feature products in different formats that Meta serves dynamically as personalized ads.
- **Instagram Shopping** — Feature in Instagram Shopping experiences, such as product tags on Instagram and soon on Instagram Shops.
- **WhatsApp** — Feature in conversational commerce in WhatsApp.

## Documentation contents {#doc_contents}

### [Overview](https://developers.facebook.com/documentation/ads-commerce/catalog/overview)

Learn more about catalog and the components it contains.

### [Get Started](https://developers.facebook.com/documentation/ads-commerce/catalog/get-started)

Learn how to successfully set up a catalog for commerce or Advantage+ catalog ads, and more.

### [Guides](https://developers.facebook.com/documentation/ads-commerce/catalog/guides)

Learn more about the various guides and how to use them in your catalog.

### [Best Practices](https://developers.facebook.com/documentation/ads-commerce/catalog/best-practices)

Tips for using catalog effectively.

### [Reference](https://developers.facebook.com/documentation/ads-commerce/catalog/reference)

Product specifications and endpoint references.

### [Support](https://developers.facebook.com/documentation/ads-commerce/catalog/support)

Solutions to common problems and troubleshooting tips.

## See also

- [Catalog Batch API](https://developers.facebook.com/documentation/ads-commerce/catalog/guides/manage-catalog-items/catalog-batch-api)
