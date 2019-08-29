import React from 'react';
import Article from './Article';

export default class Column extends React.Component {

  availableClasses = [
    'article-column-flex-start',
    'article-column-border-right'
    /*'article-column-flex-end',
    'article-column-space-between',
    'article-column-center',*/
  ];

  getRandomClass() {
    return this.availableClasses[Math.floor(Math.random()*this.availableClasses.length)];
  }

  getClassNames(isFirstColumn) {
    return isFirstColumn ? 'article-column' : `article-column ${this.getRandomClass()}`;
  }

  render() {
    return (
      <div className={this.getClassNames(this.props.isFirstColumn)}>
        {this.props.items.map((item, itemIndex) => (
          <Article key={itemIndex} title={item.title} description={item.description} link={item.link} />
        ))}
      </div>
    )
  }
}