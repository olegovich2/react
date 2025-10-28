import React from 'react';

import './Warning.css';

class Warning extends React.Component {

  render() {
    return (
      <div className='Warning'>
        <span className='Warning_Text'>
          {this.props.question}
        </span>
      </div>
    );
  }

}

export default Warning;
