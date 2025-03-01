document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const themeSwitch = document.getElementById('theme-switch');
    const themeLabel = document.getElementById('theme-label');
    const fileUpload = document.getElementById('file-upload');
    const historyPanel = document.getElementById('history-panel');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');

    let currentFile = null;
    let waitingForImagePrompt = false;

    const copyIconSVG = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19,21H9A2,2 0 0,1,7,19V7H9V19H19M16,3H5A2,2 0 0,0,3,5V17A2,2 0 0,0,5,19H16A2,2 0 0,0,18,17V5A2,2 0 0,0,16,3Z" /></svg>`;

    const WELCOME_MESSAGE = "Hello! I'm ZeQta, your intelligent AI assistant. I can help answer questions, analyze files and images, and even generate custom images for you! How can I help you today?";

    let currentConversation = { id: Date.now(), title: "New Chat", messages: [] };
    let savedConversations = [];

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
        sendButton.disabled = userInput.value.trim() === '';
    });

    themeSwitch.addEventListener('change', () => {
        document.body.classList.toggle('dark-theme', themeSwitch.checked);
        themeLabel.textContent = themeSwitch.checked ? 'Light Mode' : 'Dark Mode';
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) {
                sendMessage();
            }
        }
    });

    sendButton.addEventListener('click', sendMessage);
    fileUpload.addEventListener('change', handleFileUpload);

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        themeSwitch.checked = true;
        document.body.classList.add('dark-theme');
        themeLabel.textContent = 'Light Mode';
    }

    newChatBtn.addEventListener('click', startNewConversation);
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all conversation history? This cannot be undone.")) {
            savedConversations = [];
            localStorage.removeItem("savedConversations");
            updateHistoryUI();
        }
    });
    toggleHistoryBtn.addEventListener('click', () => {
        historyPanel.classList.add('visible');
        updateHistoryUI(); // Ensure the back button is added when panel opens
    });

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const fileIndicator = document.createElement('div');
        fileIndicator.className = 'file-indicator';
        fileIndicator.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px;">
                <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
            <span class="file-indicator-name">${file.name}</span>
            <span class="file-indicator-remove">×</span>
        `;
        
        const removeBtn = fileIndicator.querySelector('.file-indicator-remove');
        removeBtn.addEventListener('click', () => {
            fileIndicator.remove();
            currentFile = null;
            fileUpload.value = '';
        });
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                let content = e.target.result;
                
                if (file.type.startsWith('image/')) {
                    currentFile = {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        isImage: true,
                        content: content 
                    };
                    
                    const imgPreview = document.createElement('div');
                    imgPreview.className = 'image-preview';
                    imgPreview.innerHTML = `
                        <img src="${content}" alt="${file.name}" />
                    `;
                    messagesContainer.appendChild(imgPreview);
                    
                    addMessageToUI('system', `Image "${file.name}" uploaded. I'll analyze this image for you.`);
                    
                    await analyzeImage(content, file.name);
                } else {
                    currentFile = {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content: content.substring(0, 50000) 
                    };
                    
                    messagesContainer.appendChild(fileIndicator);
                    
                    addMessageToUI('system', `File "${file.name}" uploaded. You can now ask questions about this file.`);
                }
                
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
            } catch (error) {
                console.error('Error reading file:', error);
                addMessageToUI('system', 'Sorry, there was an error reading the file.');
            }
        };
        
        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else if (file.type.match('text.*') || 
            file.type.includes('javascript') || 
            file.type.includes('json') || 
            file.type.includes('css') || 
            file.type.includes('html')) {
            reader.readAsText(file);
        } else if (file.type.includes('pdf')) {
            addMessageToUI('system', 'PDF file detected. I can analyze the text content.');
            reader.readAsText(file); 
        } else {
            reader.readAsText(file); 
        }
    }

    async function analyzeImage(imageData, imageName) {
        typingIndicator.classList.remove('hidden');
        try {
            const systemMessage = "You are an expert image analyst AI. Describe what you see in this image in detail, including colors, objects, people, scenes, text visible, and any other notable elements. Be specific but concise.";
            const imageDescription = `The user has uploaded an image file named "${imageName}". Please describe what you see in this image.`;
            const completion = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: imageDescription }
                ]
            });
            typingIndicator.classList.add('hidden');
            const analysisText = `Here's my analysis of the image "${imageName}":\n\n${completion.content}`;
            addMessageToUI('ai', analysisText);
            currentConversation.messages.push({ role: 'ai', content: analysisText });
            saveCurrentConversationToStorage();
        } catch (error) {
            console.error('Error analyzing image:', error);
            typingIndicator.classList.add('hidden');
            addMessageToUI('system', 'Sorry, I encountered an error analyzing the image. You can still ask questions about it though.');
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        addMessageToUI('user', message);
        currentConversation.messages.push({ role: "user", content: message });
        userInput.value = '';
        userInput.style.height = 'auto';
        sendButton.disabled = true;
        typingIndicator.classList.remove('hidden');

        try {
            if (waitingForImagePrompt) {
                waitingForImagePrompt = false;
                await generateImage(message);
                return;
            }
            if (message.toLowerCase().includes('generate an image') || 
                message.toLowerCase().includes('create an image') || 
                message.toLowerCase().includes('make an image') ||
                message.toLowerCase().includes('draw') || 
                message.toLowerCase().includes('generate image') ||
                message.toLowerCase().includes('image of') ||
                message.toLowerCase().includes('picture of')) {
                await handleImageGenerationRequest(message);
                return;
            }
            
            let systemMessage = "You are an extraordinarily intelligent and helpful AI assistant called ZeQta made by a company called ZeQta a company that makes AI tools and develop games the craziest part it is fonded and owned by a boy born on 2010. You excel at in-depth knowledge, creative problem-solving, and thoughtful explanations. Be conversational, friendly, and occasionally use emoji for emphasis. Always prioritize accuracy and nuance in your responses. When discussing code, provide practical examples. Provide comprehensive, detailed answers that thoroughly address the user's question. Don't be overly concise - explore the topic in depth when appropriate.";
            if (currentFile) {
                if (currentFile.isImage) {
                    systemMessage += `\n\nThe user has uploaded an image file with the following details:\nFilename: ${currentFile.name}\nFile type: ${currentFile.type}\nFile size: ${formatFileSize(currentFile.size)}\n\nPlease help answer their questions about this image.`;
                } else {
                    systemMessage += `\n\nThe user has uploaded a file with the following details:\nFilename: ${currentFile.name}\nFile type: ${currentFile.type}\nFile size: ${formatFileSize(currentFile.size)}\n\nFile content:\n${currentFile.content}`;
                }
            }
            let lastMessages = currentConversation.messages.slice(-10);
            const completion = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: systemMessage },
                    ...lastMessages
                ]
            });
            currentConversation.messages.push({ role: "ai", content: completion.content });
            saveCurrentConversationToStorage();
            typingIndicator.classList.add('hidden');
            addMessageToUI('ai', completion.content);
        } catch (error) {
            console.error('Error:', error);
            typingIndicator.classList.add('hidden');
            addMessageToUI('system', 'Sorry, I encountered an error. Please try again.');
        }
    }

    async function handleImageGenerationRequest(message) {
        try {
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an AI that helps extract image generation prompts. From the following message, extract just the description of the image the user wants to generate. Respond with ONLY the image description, nothing else. Make it detailed and descriptive for best results.`
                    },
                    { role: "user", content: message }
                ]
            });
            const imagePrompt = completion.content.trim();
            await generateImage(imagePrompt);
        } catch (error) {
            console.error('Error in image generation request:', error);
            typingIndicator.classList.add('hidden');
            addMessageToUI('system', 'Sorry, I encountered an error while trying to generate an image. Please try again.');
        }
    }
    
    async function generateImage(prompt) {
        try {
            addMessageToUI('ai', `I'll generate an image based on: "${prompt}". Please wait a moment...`);
            const result = await websim.imageGen({
                prompt: prompt,
                aspect_ratio: "1:1"
            });
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-generation-result';
            const imgElement = document.createElement('img');
            imgElement.src = result.url;
            imgElement.alt = prompt;
            imageContainer.appendChild(imgElement);
            messagesContainer.appendChild(imageContainer);
            const imageMessage = `Here's the image I generated based on your request. What do you think?`;
            addMessageToUI('ai', imageMessage);
            currentConversation.messages.push({ role: 'ai', content: imageMessage });
            saveCurrentConversationToStorage();
            typingIndicator.classList.add('hidden');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            console.error('Error generating image:', error);
            typingIndicator.classList.add('hidden');
            addMessageToUI('system', 'Sorry, I encountered an error while generating the image. Please try again with a different description.');
        }
    }
    
    function addImageGenerationButton() {
        addMessageToUI('system', 'Would you like to generate an image? Click the button below or simply describe what image you would like me to create.');
        const buttonContainer = document.createElement('div');
        buttonContainer.style.textAlign = 'center';
        buttonContainer.style.margin = '10px 0';
        const generateButton = document.createElement('button');
        generateButton.className = 'generate-image-btn';
        generateButton.textContent = 'Generate an Image';
        generateButton.addEventListener('click', () => {
            waitingForImagePrompt = true;
            addMessageToUI('system', 'Please describe the image you would like me to generate:');
        });
        buttonContainer.appendChild(generateButton);
        messagesContainer.appendChild(buttonContainer);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function addInitialMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12,2C17.52,2 22,6.48 22,12C22,17.52 17.52,22 12,22C6.48,22 2,17.52 2,12C2,6.48 6.48,2 12,2M12,4C7.58,4 4,7.58 4,12C4,16.42 7.58,20 12,20C16.42,20 20,16.42 20,12C20,7.58 16.42,4 12,4M17,11H13V7H11V11H7V13H11V17H13V13H17V11Z"/>
            </svg>
        `;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `<p>${WELCOME_MESSAGE}</p>`;
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(messageDiv);
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + " bytes";
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        else return (bytes / 1048576).toFixed(1) + " MB";
    }
    
    function addMessageToUI(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        if (role === 'user') {
            avatarDiv.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
                </svg>
            `;
        } else if (role === 'ai') {
            avatarDiv.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M21,15C21,16.1 20.1,17 19,17H5C3.9,17 3,16.1 3,15V12H2V15C2,16.65 3.35,18 5,18H9V20H14V18H19C20.65,18 22,16.65 22,15V12H21V15M17,12H19V9C19,7.9 18.1,7 17,7H15V9H17V12M7,12H9V9H7V7H5C3.9,7 3,7.9 3,9V12H5V9H7V12M14,9V12H10V9H8V7H16V9H14V9Z" />
                </svg>
            `;
        } else {
            avatarDiv.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12,2C17.52,2 22,6.48 22,12C22,17.52 17.52,22 12,22C6.48,22 2,17.52 2,12C2,6.48 6.48,2 12,2M12,4C7.58,4 4,7.58 4,12C4,16.42 7.58,20 12,20C16.42,20 20,16.42 20,12C20,7.58 16.42,4 12,4M17,11H13V7H11V11H7V13H11V17H13V13H17V11Z"/>
                </svg>
            `;
        }
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        let formattedContent = processMessageContent(content);
        contentDiv.innerHTML = formattedContent;
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function processMessageContent(content) {
        content = content.replace(/```([a-z]*)([\s\S]*?)```/g, (match, language, code) => {
            return `<div class="code-block-container"><button class="copy-code-btn" title="Copy Code">${copyIconSVG}</button><pre><code class="language-${language}">${escapeHTML(code.trim())}</code></pre></div>`;
        });
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        const paragraphs = content.split('\n\n');
        content = paragraphs.map(paragraph => {
            if (paragraph.trim() === '') return '';
            return `<p>${paragraph.trim()}</p>`;
        }).join('');
        content = content.replace(/<p>(.*?)\n(.*?)<\/p>/g, function(match, p1, p2) {
            const parts = [p1, p2];
            return `<p>${parts.join('<br>')}</p>`;
        });
        content = content.replace(/<p>(\s*[-*•]\s+.*?)<\/p>/g, '<p class="list-item">$1</p>');
        return content;
    }
    
    function escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-code-btn');
        if (btn) {
            const codeElement = btn.parentElement.querySelector('pre code');
            if (codeElement) {
                const codeText = codeElement.textContent;
                navigator.clipboard.writeText(codeText).then(() => {
                    const originalHTML = copyIconSVG;
                    btn.innerHTML = "Copied!";
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error("Copy failed:", err);
                });
            }
        }
    });

    function loadSavedConversations() {
        const data = localStorage.getItem("savedConversations");
        if (data) {
            savedConversations = JSON.parse(data);
            updateHistoryUI();
        }
    }
    
    function saveSavedConversations() {
        localStorage.setItem("savedConversations", JSON.stringify(savedConversations));
    }
    
    function saveCurrentConversationToStorage() {
        localStorage.setItem("currentConversation", JSON.stringify(currentConversation));
    }
    
    function loadCurrentConversation() {
        const data = localStorage.getItem("currentConversation");
        if (data) {
            currentConversation = JSON.parse(data);
            messagesContainer.innerHTML = '';
            if (currentConversation.messages.length > 0) {
                currentConversation.messages.forEach(msg => addMessageToUI(msg.role, msg.content));
            } else {
                addInitialMessage();
                currentConversation.messages.push({ role: "system", content: WELCOME_MESSAGE });
                saveCurrentConversationToStorage();
            }
        } else {
            currentConversation = { id: Date.now(), title: "New Chat", messages: [] };
            saveCurrentConversationToStorage();
            addInitialMessage();
            currentConversation.messages.push({ role: "system", content: WELCOME_MESSAGE });
            saveCurrentConversationToStorage();
        }
    }
    
    function renderChatMessages() {
        messagesContainer.innerHTML = '';
        if (currentConversation.messages.length === 0) {
            addInitialMessage();
            currentConversation.messages.push({ role: "system", content: WELCOME_MESSAGE });
            saveCurrentConversationToStorage();
        } else {
            currentConversation.messages.forEach(msg => addMessageToUI(msg.role, msg.content));
        }
    }
    
    function startNewConversation() {
        if (currentConversation.messages.length > 0 && !savedConversations.find(c => c.id === currentConversation.id)) {
            savedConversations.push(currentConversation);
            saveSavedConversations();
            updateHistoryUI();
        }
        currentConversation = { id: Date.now(), title: "New Chat", messages: [] };
        saveCurrentConversationToStorage();
        messagesContainer.innerHTML = '';
        renderChatMessages();
    }
    
    function updateHistoryUI() {
        historyList.innerHTML = '';
        
        // Add back button for mobile
        if (window.innerWidth <= 576) {
            const backButton = document.createElement('button');
            backButton.className = 'back-button';
            backButton.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path fill="currentColor" d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
                </svg>
            `;
            backButton.addEventListener('click', () => {
                historyPanel.classList.remove('visible');
            });
            
            const historyHeader = document.querySelector('.history-header');
            if (!historyHeader.querySelector('.back-button')) {
                historyHeader.insertBefore(backButton, historyHeader.firstChild);
            }
        }

        let allConversations = [];
        if (currentConversation && currentConversation.messages.length > 0 && !savedConversations.find(c => c.id === currentConversation.id)) {
            allConversations.push(currentConversation);
        }
        allConversations = allConversations.concat(savedConversations);
        
        allConversations.forEach(convo => {
            const item = document.createElement('div');
            item.className = "conversation-item";
            const titleSpan = document.createElement('span');
            titleSpan.className = "conversation-title";
            titleSpan.textContent = convo.title;
            item.appendChild(titleSpan);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = "conversation-actions";
            const editBtn = document.createElement('button');
            editBtn.className = 'icon-button';
            editBtn.title = "Edit Title";
            editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.001 1.001 0 0 0 0-1.41l-2.34-2.34a1.001 1.001 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newTitle = prompt("Enter new title for this conversation:", convo.title);
                if (newTitle && newTitle.trim() !== "") {
                    convo.title = newTitle.trim();
                    saveSavedConversations();
                    updateHistoryUI();
                }
            });
            actionsDiv.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-button';
            deleteBtn.title = "Delete Conversation";
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"/></svg>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm("Delete this conversation?")) {
                    deleteConversation(convo.id);
                }
            });
            actionsDiv.appendChild(deleteBtn);
            item.appendChild(actionsDiv);
            item.addEventListener('click', () => {
                loadConversation(convo.id);
                if (window.innerWidth <= 576) {
                    historyPanel.classList.remove("visible");
                }
            });
            historyList.appendChild(item);
        });
    }
    
    function deleteConversation(convoId) {
        savedConversations = savedConversations.filter(c => c.id !== convoId);
        saveSavedConversations();
        updateHistoryUI();
    }
    
    function loadConversation(convoId) {
        if (currentConversation.messages.length > 0 && !savedConversations.find(c => c.id === currentConversation.id)) {
            savedConversations.push(currentConversation);
            saveSavedConversations();
            updateHistoryUI();
        }
        const convo = savedConversations.find(c => c.id === convoId);
        if (convo) {
            currentConversation = convo;
            saveCurrentConversationToStorage();
            messagesContainer.innerHTML = '';
            currentConversation.messages.forEach(msg => addMessageToUI(msg.role, msg.content));
        }
    }

    loadSavedConversations();
    loadCurrentConversation();
});
