import React from 'react';
import Page from './components/Page';
import { randomChannel } from './mockArticles';

function App() {

  const channel = randomChannel();

  return (
    <div className="App">
      <Page channel={channel}/>
    </div>
  );
}

export default App;
