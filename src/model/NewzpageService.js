import axios from 'axios';
import NewzpageMapper from './NewzpageMapper';
import Item from './Item';

export default class NewzpageService {
  constructor() {
    this.endpoint = "http://localhost:5000/";
  }

  async getChannelResults(links) {
    console.log("Getting channel results.");
    const response = await axios.post(this.endpoint + "channels", JSON.stringify(links), {
      headers: {
        'Content-Type' : 'application/json'
      }
    });
    return NewzpageMapper.toChannels(response.data);
  }

  async getSummary(link) {
    console.log(`Getting summary for "${link}"`);
    const response = await axios.get(this.endpoint + "summary?link=" + link);
    return NewzpageMapper.toParagraphs(response.data);
  }

  async addSummaryToItem(item) {
    const paragraphs = await this.getSummary(item.link);
    const newItem = new Item(...item);
    newItem.paragraphs = paragraphs;
    return newItem;
  }
}