import Media from "./Media";

export default class Item {

  constructor(properties) {
    this.title = properties.title;
    this.link = properties.link;
    this.description = properties.description;
    
    if (properties.enclosure) {
      this.enclosure = this.media = new Media(properties.enclosure);
    }
  }
}