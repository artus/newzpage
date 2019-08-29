import React from 'react';
import Column from './Column';

export default class Page extends React.Component {

  getItemsInBatches(items, size = 4) {

    if (items.length <= size)  return items;

    const allItemsSorted = [...items];
    allItemsSorted.sort((a, b) => {
      return a.description.length - b.description.length;
    });

    let currentBatch = [];
    const allBatches = [];

    // if (allItemsSorted.size % 2 !== 0) currentBatch.push(allItemsSorted.shift());

    while(allItemsSorted.length) {
      if (allItemsSorted.length <= size) {
        allBatches.push(allItemsSorted);
        break;
      }

      let fromStart = true;

      while (currentBatch.length < size) {
        currentBatch.push(fromStart ? allItemsSorted.shift() : allItemsSorted.pop());
        fromStart = !fromStart;
      }
      if (Math.random() > 0.5) currentBatch.reverse();
      allBatches.push(currentBatch);
      currentBatch = [];
    }

    return allBatches;
  }

  divideItemsInColumns(items) {
    const columnSize = Math.floor(items.length / 6);
    return this.getItemsInBatches(items, columnSize);
  }

  render() {
    return (
      <section className="page">
        <div className="page-divider"></div>
        <h2>{this.props.channel.title}</h2>
        <div className="article-column-container">
          {this.divideItemsInColumns(this.props.channel.items).map((itemBatch, batchIndex) => (
            <Column key={batchIndex} isFirstColumn={batchIndex === 0} items={itemBatch} />
          ))}
        </div>
      </section>
    )
  }
}