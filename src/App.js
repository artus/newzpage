import React from 'react';
import Page from './components/Page';
import './App.css';
import { randomChannel } from './mockArticles';

function App() {

  const channels = [
    randomChannel(),
    randomChannel(),
    randomChannel(),
    randomChannel(),
  ];

  return (
    <div className="app">
      {channels.map((channel, index) => (
        <Page key={index} title="test" channel={channel}/>
      ))}
    </div>
  );
}

export default App;
