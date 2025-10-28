import React from 'react';
import ReactDOM from 'react-dom';

import Warning from './components/Warning';

ReactDOM.render(
  <Warning question="Не трогайте мокрыми руками оголённые провода!" />, 
  document.getElementById('container') 
);
