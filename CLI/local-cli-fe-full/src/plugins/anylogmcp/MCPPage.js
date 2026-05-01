// import { useEffect, useState } from 'react';
// import ChatSelector from './ChatSelector';
// import ChatView from './ChatView';
// import chatState from './state/state';
// import Modal from '@mui/material/Modal';
// import { Box } from '@mui/material';
// import Typography from '@mui/material/Typography';
// import Button from '@mui/material/Button';
// import ConfigView from './ConfigView';

// export const pluginMetadata = {
//   name: 'Chat',
//   icon: null
// };

// const MCPPage = () => {
//   // const [selectedChat, setSelectedChat] = useState('');
//   const { selectedChat, showConfig, toggleShowConfig } = chatState();

//   return (
//     <div style={{
//       width: "100%",
//       height: "100%",
//       overflow: 'hidden'
//     }}>
//       {
//         selectedChat ? (
//           <div>
//             <ChatView externalMessages={[]} />
//             <Modal
//               open={showConfig}
//               onClose={toggleShowConfig}
//             >
//               <Box sx={style}>
//                 <ConfigView />
//               </Box>
//             </Modal>
//           </div>
//         ) : (
//           <div>
//             <ChatSelector />
//             <Modal
//               open={showConfig}
//               onClose={toggleShowConfig}
//             >
//               <Box sx={style}>
//                 <ConfigView />
//               </Box>
//             </Modal>
//           </div>
//         )
//       }
//       {/* <ChatView /> */}
//     </div>
//   )
// }


// const style = {
//   position: 'absolute',
//   top: '50%',
//   left: '50%',
//   transform: 'translate(-50%, -50%)',
//   width: 800,
//   bgcolor: 'background.paper',
//   // border: '1px solid #000',
//   boxShadow: 24,
//   borderRadius: 6,
//   p: 4,
// };

// export default MCPPage;
