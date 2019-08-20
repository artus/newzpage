import React from 'react';
import Page from './components/Page';
import './App.css';
import { randomChannel } from './mockArticles';

function App() {

  const channel = randomChannel();

  return (
    <div className="app">
      <Page channel={channel}/>
    </div>
  );
}

export default App;
