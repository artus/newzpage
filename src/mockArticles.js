import Item from "./rss/Item";
import Channel from "./rss/Channel";

function random(min, max) {
  return Math.floor(Math.random() * (+max - +min)) + min; 
}

function randomText(length) {
  const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
  const start = random(0, lorem.length - length);
  return lorem.substring(start, start + length);
}

function randomTitle() {
  return randomText(random(10, 25));
}

function randomDescription() {
  return randomText(random(35, 65));
}

function randomItem() {
  return new Item({
    title: randomTitle(),
    description: randomDescription(),
    link: "https://www.google.com"
  });
}

function randomItems(amount) {
  const items = [];
  for (let i = 0; i < amount; i++) {
    items.push(randomItem());
  }
  return items;
}

export function randomChannel() {
  return new Channel({
    title: randomTitle(),
    description: randomDescription(),
    link: "https://www.google.com",
    items: randomItems(random(20, 40))
  });
}
