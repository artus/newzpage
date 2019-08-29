import React from 'react';

export default class Article extends React.Component {

  availableClasses = [
    'article-knockout',
    'article-border',
    'article-border-dashed',
    'article-border-top',
    'article-border-left',
    'article-border-right',
    'article-border-bottom'
  ];

  getRandomClass() {
    return this.availableClasses[Math.floor(Math.random() * this.availableClasses.length)];
  }

  isSpecialArticle() {
    return Math.random() > 0.7;
  }

  getClassNames(isFirstColumn) {
    return this.isSpecialArticle() ? `article ${this.getRandomClass()}` : `article`;
  }


  isKnockout() {
    return Math.random() > 0.9;
  }

  render() {
    return (
      <article className={this.getClassNames()}>
        <h3><a href={this.props.link} rel="noopener noreferrer" target="_blank">{this.props.title}</a></h3>
        <p>{this.props.description}</p>
      </article>
    );
  }

}