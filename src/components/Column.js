import React from 'react';
import Article from './Article';

export default class Column extends React.Component {

  isWider() {
    return Math.random() > 0.9;
  }

  getClassNames() {
    let classNames = 'article-column';
    // if (this.isWider()) classNames = `${classNames} article-column-wider`;
    return classNames;
  }

  render() {
    return (
      <div className={this.getClassNames()}>
        {this.props.items.map((item, itemIndex) => (
          <Article key={itemIndex} title={item.title} description={item.description} link={item.link} />
        ))}
      </div>
    )
  }
}