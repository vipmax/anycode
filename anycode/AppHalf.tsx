import React, { useState } from 'react';
import { AnycodeEditorReact } from 'anycode-react';

const App: React.FC = () => {
    console.log('App render');
    const [editorId1, setEditorId1] = useState("id1"); 
    const [editorId2, setEditorId2] = useState("id2");

    const [text1, setText1] = useState(() =>
`function myFunction() {
    console.log('Hello, World!');
}

`.repeat(50)
    );

    const [text2, setText2] = useState(() =>
`def greet():
    print("Hello from Python!")

`.repeat(50)
    );

    return (
        <div style={{ padding: '0.3rem', height: '90vh' }}>
            <button onClick={() => {
                setEditorId1(`id1-${Math.random()}`);
                setEditorId2(`id2-${Math.random()}`);
            }}>
                update
            </button>
            <div style={{ display: 'flex', height: '100%', marginTop: '0.5rem' }}>
                <div style={{ flex: 1, paddingRight: '0.2rem', overflow: 'hidden' }}>
                    <AnycodeEditorReact id={editorId1} text={text1} />
                </div>
                <div style={{ flex: 1, paddingLeft: '0.2rem', overflow: 'hidden' }}>
                    <AnycodeEditorReact id={editorId2} text={text2} />
                </div>
            </div>
        </div>
    );
};

export default App;
