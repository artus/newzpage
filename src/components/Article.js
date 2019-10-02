import React from 'react';
import NewzpageService from '../model/NewzpageService';

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

  newzpageService = new NewzpageService();

  constructor(props) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    this.setState({
      paragraphs: await this.newzpageService.getSummary(this.props.item.link)
    });
  }

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

    let content;

    if (this.state.paragraphs) {
      content = this.state.paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>{paragraph}</p>
      ));
    } else {
      content = <p>Loading content...</p>;
    }

    return (
      <article className={this.getClassNames()}>
        <h3><a href={this.props.item.link} rel="noopener noreferrer" target="_blank">{this.props.item.title}</a></h3>
        {content}
      </article>
    );
  }

}