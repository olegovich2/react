На основе проекта RainbowFrame разработать новый проект RainbowFrameHOC в папке RainbowFrameHOC.

1. Разработать обычный React-компонент DoubleButton, который рендерит две кнопки <input type=button> и между ними — текст, пришедший в props.children.
Компонент получает три пропса — caption1 и caption2 это надписи на кнопках, cbPressed — коллбек, при нажатии на первую кнопку коллбек вызывается с аргументом 1, при нажатии на вторую — с аргументом 2.
Разместите компонент на странице, заставьте его работать. Тексты на кнопках и между кнопками могут быть любыми.
Например:
<DoubleButton caption1="однажды" caption2="пору" cbPressed={ num => alert(num) } >в студёную зимнюю</DoubleButton>

2. Разработать HOF withRainbowFrame, которая позволяет рендерить оборачиваемый компонент внутри нескольких цветных рамок.
Например:
let colors=['red','orange', 'yellow','green', '#00BFFF', 'blue', 'purple'];
let FramedDoubleButton=withRainbowFrame(colors)(DoubleButton);
. . .
<FramedDoubleButton caption1="я из лесу" caption2="мороз" cbPressed={ num => alert(num) }>вышел, был сильный</FramedDoubleButton>