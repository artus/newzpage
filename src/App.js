import React from 'react';
import Page from './components/Page';
import './App.css';
import {getChannel} from './rss/RssParser';
import NewzpageService from './model/NewzpageService';

export default class App extends React.Component {

  newzpageService = new NewzpageService();

  constructor(props) {
    super(props);
    this.state = {
      channels: []
    };
  }

  componentDidMount() {
    this.getChannels();
  }

  getChannels() {
    const newChannels = 
    this.urls.map(async url => {
      return getChannel(url);
    });
    Promise.all(newChannels).then(channels => {
      this.setState({ channels });
    });
  }

  urls = [
    'https://news.ycombinator.com/rss',
    'https://www.reddit.com/.rss'
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