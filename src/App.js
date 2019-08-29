import React from 'react';
import Page from './components/Page';
import './App.css';
import { randomChannel } from './mockArticles';
import { getChannel } from './rss/RssParser';

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {channels: []};
    this.getChannels();
  }

  getChannels() {
    const newChannels = 
    this.urls.map(async url => {
      return getChannel(url);
    });
    Promise.all(newChannels).then(channels => {
      this.setState({ channels });
    })
  }

  urls = [
    'https://www.reddit.com/.rss',
    'https://news.ycombinator.com/rss'
  ];


  render() {
    return (
      <div className="app">
        {this.state.channels.map((channel, index) => (
          <Page key={index} title="test" channel={channel} />
        ))}
      </div>
    );
  }
}