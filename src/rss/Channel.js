import Item from "./Item";

export default class Channel {

  constructor(properties) {
    this.title = properties.title;
    this.link = properties.link;
    this.description = properties.description;
    this.items = properties.items.map(item => new Item(item));
  }
}