import app from './app.js'
import './routes.js'
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server started running at port ${PORT}`)
    
})

