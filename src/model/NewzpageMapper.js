import Channel from "./Channel";
import Item from "./Item";

export default class NewzpageMapper {

  static toChannels(newzpageResponse) {
    const successes = newzpageResponse.successes;
    return successes.map(channelItem => {
      return NewzpageMapper.toChannel(channelItem.channel);
    });
  }

  static toChannel(responseChannel) {
    const items = NewzpageMapper.toItems(responseChannel.items);
    console.log(items);
    return new Channel({
      title: responseChannel.title,
      link: responseChannel.link,
      description: responseChannel.description,
      items
    });
  }

  static toItems(responseItems) {
    return responseItems.map(NewzpageMapper.toItem);
  }

  static toItem(responseItem) {
    const paragraphs = NewzpageMapper.toParagraphs(responseItem.description);
    return new Item({
      title: responseItem.title,
      link: responseItem.link,
      description: responseItem.description,
      image: responseItem.imageUrl,
      comments: responseItem.comments,
      paragraphs
    });
  }

  static toParagraphs(text) {
    return text.split('[BREAK]');
  }
}