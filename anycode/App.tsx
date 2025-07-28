import React, { useState, useEffect } from 'react';
import { AnycodeEditorReact } from 'anycode-react';

const App: React.FC = () => {
    console.log('App render');
    const [editorId, setEditorId] = useState("id"); 
    
    const [text, setText] = useState(() =>
`function myFunction() {
    console.log('Hello, World!');
}

`.repeat(50)
    );
    
    return (
        <div style={{ padding: '0.3rem', height: 'calc(100dvh - 0.6rem)' }}>
            {/* <button onClick={() => setEditorId(`id${Math.random()}`)}>update</button> */}
            <AnycodeEditorReact id={editorId} text={text} />
        </div>
    );
};

export default App;
