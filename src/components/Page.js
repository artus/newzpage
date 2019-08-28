import React from 'react';
import Column from './Column';

export default class Page extends React.Component {

  getItemsInBatches(items, size = 2) {

    const allBatches = [];
    let currentBatch = [];

    for (let currentItem = 0; currentItem < items.length; currentItem++) {
      currentBatch.push(items[currentItem]);
      if (currentBatch.length === size) {
        allBatches.push(currentBatch);
        currentBatch = [];
      }
    }

    return allBatches;
  }

  render() {
    return (
      <section className="page">
        <div className="page-divider"></div>
        <div className="article-column-container">
        {this.getItemsInBatches(this.props.channel.items).map((itemBatch, batchIndex) => (
          <Column key={batchIndex} items={itemBatch} />
        ))}
        </div>
      </section>
    )
  }
}