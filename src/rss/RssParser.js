import Channel from './Channel';
import Item from './Item';
import mockArticles from './../mockArticles';
let Parser = require('rss-parser');

export async function getChannel(url) {

  let parser = new Parser();

  let feed = await parser.parseURL("https://cors-anywhere.herokuapp.com/" + url);
  console.log(feed.title);

  const title = feed.title;
  const link = feed.link;
  const description = feed.description;
  const items = feed.items.map(item => {
    return new Item({
      title: item.title,
      description: mockArticles.randomDescription(),
      link: item.link
    });
  });

  return new Channel({
    title,
    link,
    description,
    items
  });

}