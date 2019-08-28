import React from 'react';

export default class Article extends React.Component {

  isKnockout() {
    return Math.random() > 0.9;
  }

  classNames() {
    let classNames = 'article';
    if (this.isKnockout()) classNames = `${classNames} article-knockout`;
    return classNames;
  }

  render() {
    return (
      <article className={this.classNames()}>
        <h2>{this.props.title}</h2>
        <p>{this.props.description}</p>
      </article>
    );
  }

}