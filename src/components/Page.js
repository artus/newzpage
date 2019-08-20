import React from 'react';
import Article from './Article';

export default class Page extends React.Component {

  render() {
    return (
      <section>
        <h1>{this.props.title}</h1>
        {this.props.channel.items.map((item, index) => (
          <Article key={index} title={item.title} description={item.description} link={item.link} />
        ))}
      </section>
      )
  }
}