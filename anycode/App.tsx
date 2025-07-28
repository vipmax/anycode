import React, { useState, useEffect } from 'react';
import { AnycodeEditorReact } from 'anycode-react';

const App: React.FC = () => {
    console.log('App render');
    const [editorId, setEditorId] = useState("id"); 
    
    const [text, setText] = useState(() =>
`function myFunction() {
    console.log('Hello, World!');
}

`.repeat(5000)
    );
    
    return (
        <div style={{ padding: '0.3rem', height: '90vh' }}>
            <button onClick={() => setEditorId(`id${Math.random()}`)}>update</button>
            <AnycodeEditorReact id={editorId} text={text} />
        </div>
    );
};

export default App;
