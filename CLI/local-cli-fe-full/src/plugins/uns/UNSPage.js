import React, { useState, useEffect, useRef } from 'react';
import './UNSPage.css';
import UNSSidePanel from './UNSSidePanel';
import { getRoot, getChildren, checkChildren, queryMetadata, queryTable, checkTable } from './uns_api';

const UNSPage = () => {
  return (
    <div>
    <h1>UNS Page</h1>
    </div>
  )
};

export default UNSPage;
// const UNSPage = ({ node }) => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [currentPath, setCurrentPath] = useState([]); // Array of {id, name, data}
//   const [layers, setLayers] = useState([]); // Array of arrays, each array is a layer of items
//   const [expandedItems, setExpandedItems] = useState(new Set()); // Track which items are expanded
//   const [itemsWithChildren, setItemsWithChildren] = useState(new Set()); // Cache which items have children
//   const [itemsWithoutChildren, setItemsWithoutChildren] = useState(new Set()); // Cache which items don't have children
//   const [hoveredItem, setHoveredItem] = useState(null);
//   const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
//   const [hoverTimeout, setHoverTimeout] = useState(null);
//   const [selectedItem, setSelectedItem] = useState(null); // Selected item for side panel
//   const [isSidePanelOpen, setIsSidePanelOpen] = useState(false); // Side panel visibility
//   const [rootQuery, setRootQuery] = useState('blockchain get root policies'); // Configurable root query
//   const [timeRangeValue, setTimeRangeValue] = useState(5); // Time range value (default 5)
//   const [timeRangeUnit, setTimeRangeUnit] = useState('minute'); // Time range unit (default: minute)
//   const [timeColumn, setTimeColumn] = useState('insert_timestamp'); // Time column: insert_timestamp or timestamp
//   const [sqlData, setSqlData] = useState(null); // SQL query results
//   const [sqlLoading, setSqlLoading] = useState(false); // SQL query loading state
//   const [sqlError, setSqlError] = useState(null); // SQL query error
//   const [chartYKey, setChartYKey] = useState(null); // Selected value column for line chart
//   const [itemsWithData, setItemsWithData] = useState(new Map()); // Cache: item key (dbms:table) -> has_data (boolean)
//   const [checkingData, setCheckingData] = useState(new Set()); // Track items currently being checked
//   const checkTimeoutsRef = useRef([]); // Track all pending timeout IDs for cleanup
//   const [checkingChildren, setCheckingChildren] = useState(new Set()); // Track items currently being checked for children
//   const childrenCheckTimeoutsRef = useRef([]); // Track all pending timeout IDs for children checks

//   // Load root items on mount or when node changes
//   useEffect(() => {
//     if (node) {
//       loadRootItems();
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [node]); // Only reload when node changes, not when rootQuery changes

//   // Cleanup timeout on unmount
//   useEffect(() => {
//     return () => {
//       if (hoverTimeout) {
//         clearTimeout(hoverTimeout);
//       }
//     };
//   }, [hoverTimeout]);


//   // Background check for table data when layers change
//   useEffect(() => {
//     // Cancel all pending checks from previous layers
//     checkTimeoutsRef.current.forEach(timeoutId => {
//       if (timeoutId) {
//         clearTimeout(timeoutId);
//       }
//     });
//     checkTimeoutsRef.current = [];
    
//     // Clear checking state for items not in current layer
//     if (layers.length === 0 || !node) {
//       setCheckingData(new Set());
//       return;
//     }

//     // Get the current layer (last one)
//     const currentLayer = layers[layers.length - 1];
//     if (!currentLayer || currentLayer.length === 0) {
//       setCheckingData(new Set());
//       return;
//     }

//     // Build set of cache keys for items in current layer
//     const currentLayerCacheKeys = new Set();
//     for (const item of currentLayer) {
//       const itemData = getItemData(item);
//       if (itemData && itemData.dbms && itemData.table) {
//         const cacheKey = `${itemData.dbms}:${itemData.table}`;
//         currentLayerCacheKeys.add(cacheKey);
//       }
//     }

//     // Clear checking state for items not in current layer
//     setCheckingData(prev => {
//       const newSet = new Set();
//       for (const key of prev) {
//         if (currentLayerCacheKeys.has(key)) {
//           newSet.add(key);
//         }
//       }
//       return newSet;
//     });

//     // Find items with dbms and table that haven't been checked yet
//     const itemsToCheck = [];
//     for (const item of currentLayer) {
//       const itemData = getItemData(item);
//       if (itemData && itemData.dbms && itemData.table) {
//         const cacheKey = `${itemData.dbms}:${itemData.table}`;
//         // Only check if not already cached and not currently checking
//         if (!itemsWithData.has(cacheKey) && !checkingData.has(cacheKey)) {
//           itemsToCheck.push({ dbms: itemData.dbms, table: itemData.table, cacheKey });
//         }
//       }
//     }

//     // Process items one at a time with a delay to avoid overwhelming the server
//     if (itemsToCheck.length > 0) {
//       let index = 0;
//       let cancelled = false;
      
//       const processNext = () => {
//         if (cancelled || index >= itemsToCheck.length) return;
        
//         const item = itemsToCheck[index];
//         checkTableData(item.dbms, item.table).then(() => {
//           if (cancelled) return;
//           index++;
//           // Add a small delay between checks (200ms) to avoid overwhelming the server
//           if (index < itemsToCheck.length) {
//             const timeoutId = setTimeout(processNext, 200);
//             checkTimeoutsRef.current.push(timeoutId);
//           }
//         });
//       };
      
//       // Start processing after a short delay
//       const initialTimeoutId = setTimeout(processNext, 100);
//       checkTimeoutsRef.current.push(initialTimeoutId);
      
//       // Cleanup: cancel pending checks if layers change or component unmounts
//       return () => {
//         cancelled = true;
//         checkTimeoutsRef.current.forEach(timeoutId => {
//           if (timeoutId) {
//             clearTimeout(timeoutId);
//           }
//         });
//         checkTimeoutsRef.current = [];
//       };
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [layers, node]); // Re-check when layers or node changes

//   // Background check for children when layers change
//   useEffect(() => {
//     // Cancel all pending children checks from previous layers
//     childrenCheckTimeoutsRef.current.forEach(timeoutId => {
//       if (timeoutId) {
//         clearTimeout(timeoutId);
//       }
//     });
//     childrenCheckTimeoutsRef.current = [];
    
//     if (layers.length === 0 || !node) {
//       setCheckingChildren(new Set());
//       return;
//     }

//     // Get the current layer (last one)
//     const currentLayer = layers[layers.length - 1];
//     if (!currentLayer || currentLayer.length === 0) {
//       setCheckingChildren(new Set());
//       return;
//     }

//     // Build set of item IDs in current layer
//     const currentLayerItemIds = new Set();
//     for (const item of currentLayer) {
//       const itemId = getItemId(item);
//       if (itemId) {
//         currentLayerItemIds.add(itemId);
//       }
//     }

//     // Clear checking state for items not in current layer
//     setCheckingChildren(prev => {
//       const newSet = new Set();
//       for (const itemId of prev) {
//         if (currentLayerItemIds.has(itemId)) {
//           newSet.add(itemId);
//         }
//       }
//       return newSet;
//     });

//     // Find items that haven't been checked for children yet
//     const itemsToCheck = [];
//     for (const item of currentLayer) {
//       const itemId = getItemId(item);
//       if (itemId) {
//         const itemKey = `${layers.length - 1}-${itemId}`;
//         // Only check if not already cached and not currently checking
//         if (!itemsWithChildren.has(itemKey) && !itemsWithoutChildren.has(itemKey) && !checkingChildren.has(itemId)) {
//           itemsToCheck.push({ itemId, itemKey });
//         }
//       }
//     }

//     // Process items one at a time with a delay to avoid overwhelming the server
//     if (itemsToCheck.length > 0) {
//       let index = 0;
//       let cancelled = false;
      
//       const processNext = () => {
//         if (cancelled || index >= itemsToCheck.length) return;
        
//         const item = itemsToCheck[index];
//         checkItemChildren(item.itemId, item.itemKey).then(() => {
//           if (cancelled) return;
//           index++;
//           // Add a small delay between checks (200ms) to avoid overwhelming the server
//           if (index < itemsToCheck.length) {
//             const timeoutId = setTimeout(processNext, 200);
//             childrenCheckTimeoutsRef.current.push(timeoutId);
//           }
//         });
//       };
      
//       // Start processing after a short delay
//       const initialTimeoutId = setTimeout(processNext, 100);
//       childrenCheckTimeoutsRef.current.push(initialTimeoutId);
      
//       // Cleanup: cancel pending checks if layers change or component unmounts
//       return () => {
//         cancelled = true;
//         childrenCheckTimeoutsRef.current.forEach(timeoutId => {
//           if (timeoutId) {
//             clearTimeout(timeoutId);
//           }
//         });
//         childrenCheckTimeoutsRef.current = [];
//       };
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [layers, node]); // Re-check when layers or node changes

//   const loadRootItems = async () => {
//     if (!node) {
//       setError('No node selected. Please select a node first.');
//       return;
//     }

//     if (!rootQuery.trim()) {
//       setError('Root query cannot be empty.');
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       const result = await getRoot(node, rootQuery);
      
//       if (result.success && result.data) {
//         // Log the structure for debugging
//         console.log('UNS: Root items received:', result.data);
//         if (result.data.length > 0) {
//           console.log('UNS: First item structure:', result.data[0]);
//         }
        
//         // Initialize with root layer
//         setLayers([result.data]);
//         setCurrentPath([]);
//         setExpandedItems(new Set());
//       } else {
//         setError('Failed to load root items');
//       }
//     } catch (err) {
//       console.error('Error loading root items:', err);
//       setError(err.message || 'Failed to load root items');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const getItemId = (item) => {
//     if (!item || typeof item !== 'object') {
//       return null;
//     }
    
//     // Handle structure: {key: {data}} - find the nested object first
//     const keys = Object.keys(item);
//     if (keys.length === 1 && typeof item[keys[0]] === 'object' && !Array.isArray(item[keys[0]])) {
//       // This is the {key: {data}} structure
//       const nested = item[keys[0]];
//       if (nested.id) return nested.id;
//     }
    
//     // Also check for legacy structures
//     if (item.namespace && item.namespace.id) return item.namespace.id;
//     if (item.device && item.device.id) return item.device.id;
//     if (item.sensor && item.sensor.id) return item.sensor.id;
//     if (item.id) return item.id;
    
//     return null;
//   };

//   const getItemName = (item) => {
//     if (!item || typeof item !== 'object') {
//       return String(item || 'Unknown');
//     }
    
//     // Handle structure: {key: {data}} - this is the main structure
//     const keys = Object.keys(item);
//     if (keys.length === 1 && typeof item[keys[0]] === 'object' && !Array.isArray(item[keys[0]])) {
//       // This is the {key: {data}} structure - extract from nested object
//       const nested = item[keys[0]];
//       // First try 'name' field (preferred)
//       if (nested.name) return nested.name;
//       // Then try 'id' field
//       if (nested.id) return nested.id;
//     }
    
//     // Legacy structures (namespace, device, sensor)
//     if (item.namespace) {
//       if (item.namespace.name) return item.namespace.name;
//       if (item.namespace.id) return item.namespace.id;
//     }
//     if (item.device) {
//       if (item.device.name) return item.device.name;
//       if (item.device.id) return item.device.id;
//     }
//     if (item.sensor) {
//       if (item.sensor.name) return item.sensor.name;
//       if (item.sensor.id) return item.sensor.id;
//     }
    
//     // Check top-level fields
//     if (item.name) return item.name;
//     if (item.id) return item.id;
    
//     // Check all keys for nested objects that might have name/id
//     for (const key of keys) {
//       if (item[key] && typeof item[key] === 'object' && !Array.isArray(item[key])) {
//         const nested = item[key];
//         if (nested.name) return nested.name;
//         if (nested.id) return nested.id;
//       }
//     }
    
//     // Last resort: use the first meaningful string value
//     for (const key of keys) {
//       if (typeof item[key] === 'string' && item[key].trim() && key !== 'date' && key !== 'ledger') {
//         return item[key];
//       }
//     }
    
//     // If we have a single key, use that as the name
//     if (keys.length === 1) {
//       return keys[0];
//     }
    
//     // Final fallback - use a truncated JSON representation
//     const jsonStr = JSON.stringify(item);
//     if (jsonStr.length > 0) {
//       return jsonStr.substring(0, 30) + (jsonStr.length > 30 ? '...' : '');
//     }
    
//     return 'Unknown';
//   };

//   const getItemType = (item) => {
//     if (!item || typeof item !== 'object') {
//       return 'unknown';
//     }
    
//     // Handle structure: {key: {data}} - use the key as the type
//     const keys = Object.keys(item);
//     if (keys.length === 1 && typeof item[keys[0]] === 'object' && !Array.isArray(item[keys[0]])) {
//       return keys[0]; // Return the key (config, master, license, cluster, operator, table, etc.)
//     }
    
//     // Legacy structures
//     if (item.namespace) return 'namespace';
//     if (item.device) return 'device';
//     if (item.sensor) return 'sensor';
    
//     return 'unknown';
//   };

//   const getItemData = (item) => {
//     if (!item || typeof item !== 'object') {
//       return item;
//     }
    
//     // Handle structure: {key: {data}} - return the nested data object
//     const keys = Object.keys(item);
//     if (keys.length === 1 && typeof item[keys[0]] === 'object' && !Array.isArray(item[keys[0]])) {
//       return item[keys[0]]; // Return the nested data object
//     }
    
//     // Legacy structures
//     if (item.namespace) return item.namespace;
//     if (item.device) return item.device;
//     if (item.sensor) return item.sensor;
    
//     return item;
//   };

//   const hasChildren = async (itemId) => {
//     try {
//       const result = await getChildren(node, itemId);
//       return result.success && result.data && result.data.length > 0;
//     } catch {
//       return false;
//     }
//   };

//   const checkItemChildren = async (itemId, itemKey) => {
//     if (!node || !itemId) return false;
    
//     // If already cached, return cached value
//     if (itemsWithChildren.has(itemKey)) {
//       return true;
//     }
//     if (itemsWithoutChildren.has(itemKey)) {
//       return false;
//     }
    
//     // If currently checking, return null (don't check again)
//     if (checkingChildren.has(itemId)) {
//       return null;
//     }
    
//     // Mark as checking
//     setCheckingChildren(prev => new Set(prev).add(itemId));
    
//     try {
//       const result = await checkChildren(node, itemId);
      
//       // Only consider it has_children if success is True AND has_children is True
//       const hasChildren = result.success === true && result.has_children === true;
      
//       // Cache the result
//       if (result.success !== undefined) {
//         if (hasChildren) {
//           setItemsWithChildren(prev => new Set(prev).add(itemKey));
//         } else {
//           setItemsWithoutChildren(prev => new Set(prev).add(itemKey));
//         }
//       }
      
//       return hasChildren;
//     } catch (err) {
//       console.error('Error checking children:', err);
//       // On error, assume no children and cache that
//       setItemsWithoutChildren(prev => new Set(prev).add(itemKey));
//       return false;
//     } finally {
//       // Remove from checking set
//       setCheckingChildren(prev => {
//         const newSet = new Set(prev);
//         newSet.delete(itemId);
//         return newSet;
//       });
//     }
//   };

//   const expandItem = async (item, layerIndex) => {
//     const itemId = getItemId(item);
//     if (!itemId) {
//       console.log('UNS: Cannot expand item - no ID found:', item);
//       return;
//     }

//     const expandedKey = `${layerIndex}-${itemId}`;
    
//     // If already expanded, collapse it
//     if (expandedItems.has(expandedKey)) {
//       const newExpanded = new Set(expandedItems);
//       newExpanded.delete(expandedKey);
//       setExpandedItems(newExpanded);
      
//       // Remove layers after this one
//       const newLayers = layers.slice(0, layerIndex + 1);
//       setLayers(newLayers);
//       setCurrentPath(currentPath.slice(0, layerIndex));
//       // Scroll to top when collapsing
//       window.scrollTo({ top: 0, behavior: 'smooth' });
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     // Log the command being sent
//     const command = `blockchain get * where [id] = "${itemId}" bring.children`;
//     console.log('UNS: Clicking on item:', {
//       itemId: itemId,
//       itemName: getItemName(item),
//       itemType: getItemType(item),
//       command: command,
//       connection: node
//     });

//     try {
//       const result = await getChildren(node, itemId);
      
//       console.log('UNS: Response received:', {
//         success: result.success,
//         dataLength: result.data ? result.data.length : 0,
//         hasChildren: result.data && result.data.length > 0
//       });
      
//       if (result.success && result.data !== undefined) {
//         const children = result.data;
        
//         // Cache whether this item has children
//         const itemKey = `${layerIndex}-${itemId}`;
//         if (children && children.length > 0) {
//           console.log(`UNS: Item ${itemId} has ${children.length} children`);
//           const newHasChildren = new Set(itemsWithChildren);
//           newHasChildren.add(itemKey);
//           setItemsWithChildren(newHasChildren);
          
//           // Mark as expanded
//           const newExpanded = new Set(expandedItems);
//           newExpanded.add(expandedKey);
//           setExpandedItems(newExpanded);

//           // Add new layer
//           const newLayers = [...layers.slice(0, layerIndex + 1), children];
//           setLayers(newLayers);

//           // Update path
//           const newPath = [...currentPath.slice(0, layerIndex), {
//             id: itemId,
//             name: getItemName(item),
//             data: getItemData(item)
//           }];
//           setCurrentPath(newPath);
          
//           // Scroll to top when expanding to new layer
//           window.scrollTo({ top: 0, behavior: 'smooth' });
//         } else {
//           // No children - mark as leaf node
//           console.log(`UNS: Item ${itemId} has no children (empty array or undefined)`);
//           const newNoChildren = new Set(itemsWithoutChildren);
//           newNoChildren.add(itemKey);
//           setItemsWithoutChildren(newNoChildren);
//         }
//       } else {
//         setError('Failed to load children');
//       }
//     } catch (err) {
//       console.error('Error expanding item:', err);
//       setError(err.message || 'Failed to expand item');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const navigateToLayer = (targetLayerIndex) => {
//     // Navigate back to a specific layer
//     const newLayers = layers.slice(0, targetLayerIndex + 1);
//     setLayers(newLayers);
//     setCurrentPath(currentPath.slice(0, targetLayerIndex));
    
//     // Update expanded items to match - only items in the path up to targetLayerIndex
//     const newExpanded = new Set();
//     const newHasChildren = new Set();
    
//     // Mark items in the path as expanded and having children
//     for (let i = 0; i < targetLayerIndex; i++) {
//       if (i < currentPath.length) {
//         const pathItem = currentPath[i];
//         const key = `${i}-${pathItem.id}`;
//         newExpanded.add(key);
//         newHasChildren.add(key);
//       }
//     }
    
//     setExpandedItems(newExpanded);
//     // Merge with existing itemsWithChildren to preserve cache
//     const mergedHasChildren = new Set([...itemsWithChildren, ...newHasChildren]);
//     setItemsWithChildren(mergedHasChildren);
//     // Keep itemsWithoutChildren as is - we don't need to clear it
    
//     // Scroll to top when navigating
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   };

//   const handleItemHover = (e, item) => {
//     // Clear any existing timeout
//     if (hoverTimeout) {
//       clearTimeout(hoverTimeout);
//     }
    
//     // Set a timeout to show tooltip after 1 second
//     const timeout = setTimeout(() => {
//       setHoveredItem(item);
//       setHoverPosition({ x: e.clientX, y: e.clientY });
//     }, 1000);
    
//     setHoverTimeout(timeout);
//   };

//   const handleItemLeave = () => {
//     // Clear the timeout if user leaves before 1 second
//     if (hoverTimeout) {
//       clearTimeout(hoverTimeout);
//       setHoverTimeout(null);
//     }
//     setHoveredItem(null);
//   };

//   const fetchMetadata = async (dbms, table, whereClause, column) => {
//       if (!node || !dbms || !table) return;

//       setMetadataLoading(true);
//       setMetadataError(null);

//       try {
//         const result = await queryMetadata(node, {
//           dbms,
//           table,
//           time_value: timeRangeValue,
//           time_unit: timeRangeUnit,
//           where: whereClause,
//           column,
//           time_column: timeColumn,
//         });

//         console.log('UNS: Metadata query result:', {
//           success: result.success,
//           dataType: typeof result.data,
//           raw: result,
//         });

//         if (result.success) {
//           setMetadata(result.data);
//         } else {
//           setMetadataError(result.error || 'Failed to fetch metadata');
//         }
//       } catch (err) {
//         console.error('Error fetching metadata:', err);
//         setMetadataError(err.message || 'Failed to fetch metadata');
//       } finally {
//         setMetadataLoading(false);
//       }
//   };

//   const fetchSqlData = async (dbms, table, whereClause, column) => {
//     if (!node || !dbms || !table) return;

//     setSqlLoading(true);
//     setSqlError(null);

//     try {
//       const result = await queryTable(node, {
//         dbms,
//         table,
//         time_value: timeRangeValue,
//         time_unit: timeRangeUnit,
//         where: whereClause,
//         column,
//         time_column: timeColumn,
//       });
      
//       console.log('UNS: SQL query result:', {
//         success: result.success,
//         dataLength: result.data ? result.data.length : 0,
//         dataType: Array.isArray(result.data) ? 'array' : typeof result.data
//       });
      
//       if (result.success) {
//         console.log(`UNS: Setting ${result.data ? result.data.length : 0} rows in state`);
//         setSqlData(result.data);
//       } else {
//         setSqlError(result.error || 'Failed to fetch table data');
//       }
//     } catch (err) {
//       console.error('Error fetching SQL data:', err);
//       setSqlError(err.message || 'Failed to fetch table data');
//     } finally {
//       setSqlLoading(false);
//     }
//   };

//   const checkTableData = async (dbms, table) => {
//     if (!node || !dbms || !table) return false;
    
//     // Create a cache key
//     const cacheKey = `${dbms}:${table}`;
    
//     // If already cached, return cached value
//     if (itemsWithData.has(cacheKey)) {
//       return itemsWithData.get(cacheKey);
//     }
    
//     // If currently checking, return null (don't check again)
//     if (checkingData.has(cacheKey)) {
//       return null;
//     }
    
//     // Mark as checking
//     setCheckingData(prev => new Set(prev).add(cacheKey));
    
//     try {
//       const result = await checkTable(node, { dbms, table });
      
//       // Only consider it has_data if success is True AND has_data is True
//       // If success is False or has_data is False, treat as no data
//       const hasData = result.success === true && result.has_data === true;
      
//       // Only cache if we got a definitive result (true or false)
//       // Don't cache errors or undefined states
//       if (result.success !== undefined) {
//         setItemsWithData(prev => {
//           const newMap = new Map(prev);
//           // Only cache true values - false means no data, don't cache false to allow re-checking
//           // Actually, let's cache false too so we don't keep re-checking failed tables
//           newMap.set(cacheKey, hasData);
//           return newMap;
//         });
//       }
      
//       return hasData;
//     } catch (err) {
//       console.error('Error checking table data:', err);
//       // On any error (network, parsing, etc.), assume no data and cache that
//       setItemsWithData(prev => {
//         const newMap = new Map(prev);
//         newMap.set(cacheKey, false);
//         return newMap;
//       });
//       return false;
//     } finally {
//       // Remove from checking set
//       setCheckingData(prev => {
//         const newSet = new Set(prev);
//         newSet.delete(cacheKey);
//         return newSet;
//       });
//     }
//   };

//   const toggleSidePanel = (item) => {
//     const itemId = getItemId(item);
//     const isCurrentlySelected = selectedItem && getItemId(selectedItem) === itemId;
    
//     // If clicking on the already selected item and panel is open, close it
//     if (isCurrentlySelected && isSidePanelOpen) {
//       setIsSidePanelOpen(false);
//       setSelectedItem(null);
//       setSqlData(null);
//       setSqlError(null);
//     } else {
//       // Otherwise, open/update the side panel with this item
//       setSelectedItem(item);
//       setIsSidePanelOpen(true);
//       setSqlData(null);
//       setSqlError(null);
//       setChartYKey(null); // Reset so chart defaults to policy column for new item
//       setTimeColumn('insert_timestamp'); // Reset time column when opening new item
      
//       // Only fetch SQL data if get data nodes confirmed there is a table at this location
//       const itemData = getItemData(item);
//       const hasTableMeta = itemData && itemData.dbms && itemData.table;
//       const tableCacheKey = hasTableMeta ? `${itemData.dbms}:${itemData.table}` : null;
//       const hasDataAtLocation = tableCacheKey ? (itemsWithData.get(tableCacheKey) === true) : false;
//       if (hasDataAtLocation) {
//         fetchSqlData(itemData.dbms, itemData.table, itemData.where, itemData.column);
//       }
//     }
//   };

//   const renderItem = (item, layerIndex, itemIndex) => {
//     const itemId = getItemId(item);
//     const itemName = getItemName(item);
//     const itemType = getItemType(item);
//     const itemData = getItemData(item);
//     const expandedKey = `${layerIndex}-${itemId}`;
//     const itemKey = `${layerIndex}-${itemId}`;
//     const isExpanded = expandedItems.has(expandedKey);
    
//     // Check if this item has children
//     // If we've already checked and it has no children, it's a leaf
//     const hasNoChildren = itemsWithoutChildren.has(itemKey);
//     // If we've already checked and it has children, or if it's expanded (meaning we loaded children), it has children
//     const hasChildren = itemsWithChildren.has(itemKey) || isExpanded;
//     // Check if currently checking for children
//     const isCheckingChildren = checkingChildren.has(itemId);
    
//     // Check if item has table data (for visual indicator)
//     const hasTable = itemData && itemData.dbms && itemData.table;
//     const tableCacheKey = hasTable ? `${itemData.dbms}:${itemData.table}` : null;
//     const hasData = tableCacheKey ? (itemsWithData.get(tableCacheKey) ?? null) : null;
//     const isCheckingData = tableCacheKey ? checkingData.has(tableCacheKey) : false;
    
//     // Determine icon based on whether item has children
//     let icon = '📄'; // Default file icon
//     if (hasChildren) {
//       icon = isExpanded ? '📂' : '📁'; // Folder icons (open/closed)
//     } else if (hasNoChildren) {
//       // Item confirmed to have no children - use file icon
//       icon = '📄';
//     } else if (isCheckingChildren) {
//       // Still checking - show folder icon as placeholder (will update when check completes)
//       icon = '📁';
//     } else {
//       // Not checked yet - show folder icon as default (will be updated when background check completes)
//       icon = '📁';
//     }

//     const handleItemClick = (e) => {
//       // Left click: only expand/collapse if item has children or might have children
//       // Don't expand if clicking on the info button
//       if ((hasChildren || !hasNoChildren) && !e.target.closest('.uns-item-info-btn')) {
//         expandItem(item, layerIndex);
//       }
//     };

//     const handleItemRightClick = (e) => {
//       // Right click: toggle side panel with item details
//       e.preventDefault(); // Prevent default browser context menu
//       toggleSidePanel(item);
//     };

//     const handleInfoButtonClick = (e) => {
//       // Info button click: toggle side panel with item details
//       e.stopPropagation(); // Prevent triggering the item click
//       toggleSidePanel(item);
//     };

//     const isSelected = selectedItem && getItemId(selectedItem) === itemId;
    
//     // Add data indicator class ONLY if item definitively has data (true)
//     // Don't add any class if hasData is false or null (no data or not checked)
//     const dataIndicatorClass = hasData === true ? 'has-data' : '';
//     const checkingClass = isCheckingData ? 'checking-data' : '';

//     return (
//       <div
//         key={`${layerIndex}-${itemIndex}-${itemId}`}
//         className={`uns-item ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''} ${dataIndicatorClass} ${checkingClass}`}
//         onMouseEnter={(e) => handleItemHover(e, item)}
//         onMouseLeave={handleItemLeave}
//         onClick={handleItemClick}
//         onContextMenu={handleItemRightClick}
//         style={{ cursor: (hasChildren || !hasNoChildren) ? 'pointer' : 'default' }}
//       >
//         <div className="uns-item-icon">
//           {icon}
//         </div>
//         <div className="uns-item-name">
//           {itemName}
//           {/* Only show data indicator if we have a definitive result (true = has data) */}
//           {/* Don't show anything if hasData is false or null (no data or not checked yet) */}
//           {hasTable && hasData === true && (
//             <span className="uns-item-data-indicator" title="Table has data"> 💾</span>
//           )}
//           {hasTable && isCheckingData && (
//             <span className="uns-item-data-indicator checking" title="Checking for data..."> ⏳</span>
//           )}
//         </div>
//         <div className="uns-item-actions">
//           <button
//             className="uns-item-info-btn"
//             onClick={handleInfoButtonClick}
//             title="View item details"
//             aria-label="View item details"
//           >
//             ℹ️
//           </button>
//           {(hasChildren || !hasNoChildren) && (
//             <div className="uns-item-expand">
//               {isExpanded ? '▼' : '▶'}
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   };

//   const navigateToRoot = () => {
//     // Reset to root
//     if (layers.length > 0) {
//       setLayers([layers[0]]);
//       setCurrentPath([]);
//       setExpandedItems(new Set());
//       // Clear children cache when going to root (optional - you might want to keep it)
//       // setItemsWithChildren(new Set());
//       // setItemsWithoutChildren(new Set());
//     }
//     // Scroll to top when going to root
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   };

//   const renderBreadcrumb = () => {
//     if (currentPath.length === 0) return null;

//     return (
//       <div className="uns-breadcrumb">
//         <button 
//           className="uns-breadcrumb-item" 
//           onClick={navigateToRoot}
//         >
//           🏠 Root
//         </button>
//         {currentPath.map((pathItem, index) => {
//           // The breadcrumb index corresponds to layer index + 1
//           // path[0] shows layer 1, path[1] shows layer 2, etc.
//           const targetLayerIndex = index + 1;
//           const isCurrentLayer = targetLayerIndex === layers.length - 1;
          
//           return (
//             <React.Fragment key={index}>
//               <span className="uns-breadcrumb-separator">/</span>
//               <button
//                 className={`uns-breadcrumb-item ${isCurrentLayer ? 'uns-breadcrumb-current' : ''}`}
//                 onClick={() => {
//                   // If clicking on the current layer, do nothing (or could scroll to top)
//                   if (!isCurrentLayer) {
//                     navigateToLayer(targetLayerIndex);
//                   } else {
//                     // Already on this layer, just scroll to top
//                     window.scrollTo({ top: 0, behavior: 'smooth' });
//                   }
//                 }}
//                 style={{ 
//                   cursor: isCurrentLayer ? 'default' : 'pointer',
//                   fontWeight: isCurrentLayer ? 'bold' : 'normal'
//                 }}
//               >
//                 {pathItem.name}
//               </button>
//             </React.Fragment>
//           );
//         })}
//       </div>
//     );
//   };


//   return (
//     <div className="uns-container">
//       <div className="uns-header">
//         <h1>Unified Namespace (UNS)</h1>
//         <div className="uns-header-controls">
//           <div className="uns-query-input-group">
//             <label htmlFor="root-query" className="uns-query-label">Root Query:</label>
//             <input
//               id="root-query"
//               type="text"
//               value={rootQuery}
//               onChange={(e) => setRootQuery(e.target.value)}
//               onKeyPress={(e) => {
//                 if (e.key === 'Enter' && !loading && node) {
//                   loadRootItems();
//                 }
//               }}
//               placeholder="blockchain get *"
//               className="uns-query-input"
//               disabled={loading}
//             />
//           </div>
//           <button 
//             onClick={loadRootItems} 
//             disabled={loading || !node || !rootQuery.trim()}
//             className="uns-refresh-btn"
//           >
//             🔄 Refresh
//           </button>
//         </div>
//       </div>

//       {!node && (
//         <div className="uns-error">
//           ⚠️ No node selected. Please select a node first.
//         </div>
//       )}

//       {error && (
//         <div className="uns-error">
//           ❌ Error: {error}
//         </div>
//       )}

//       <div className={`uns-main-content ${isSidePanelOpen ? 'uns-panel-open' : ''}`}>
//         <div className="uns-main-content-wrapper">
//           {renderBreadcrumb()}

//           <div className="uns-layers">
//         {layers.length > 0 && (() => {
//           // Only show the current layer (the last one)
//           const currentLayerIndex = layers.length - 1;
//           const currentLayer = layers[currentLayerIndex];
//           const layerName = currentLayerIndex === 0 
//             ? 'Root' 
//             : (currentPath[currentLayerIndex - 1]?.name || `Layer ${currentLayerIndex}`);
          
//           return (
//             <div key={currentLayerIndex} className="uns-layer">
//               <div className="uns-layer-header">
//                 {layerName}
//               </div>
//               <div className="uns-layer-content">
//                 {loading ? (
//                   <div className="uns-loading">Loading...</div>
//                 ) : currentLayer.length === 0 ? (
//                   <div className="uns-empty">No items found</div>
//                 ) : (
//                   currentLayer.map((item, itemIndex) => renderItem(item, currentLayerIndex, itemIndex))
//                 )}
//               </div>
//             </div>
//           );
//         })()}
//           </div>
//         </div>

//         {/* Side Panel for detailed view */}
//         <UNSSidePanel
//           isOpen={isSidePanelOpen}
//           selectedItem={selectedItem}
//           itemsWithData={itemsWithData}
//           conn={node}
//           sqlData={sqlData}
//           sqlLoading={sqlLoading}
//           sqlError={sqlError}
//           timeRangeValue={timeRangeValue}
//           timeRangeUnit={timeRangeUnit}
//           timeColumn={timeColumn}
//           onTimeColumnChange={setTimeColumn}
//           onClose={() => {
//             setIsSidePanelOpen(false);
//             setSelectedItem(null);
//             setSqlData(null);
//             setSqlError(null);
//           }}
//           onTimeRangeValueChange={setTimeRangeValue}
//           onTimeRangeUnitChange={setTimeRangeUnit}
//           onFetchTimeRange={fetchMetadata}
//           onFetchTimeRange={fetchSqlData}
//           getItemName={getItemName}
//           getItemType={getItemType}
//           getItemId={getItemId}
//           getItemData={getItemData}
//           chartYKey={chartYKey}
//           onChartYKeyChange={setChartYKey}
//         />
//       </div>

//       {hoveredItem && (
//         <div
//           className="uns-tooltip"
//           style={{
//             left: `${hoverPosition.x + 10}px`,
//             top: `${hoverPosition.y + 10}px`
//           }}
//         >
//           <div className="uns-tooltip-header">
//             <strong>{getItemName(hoveredItem)}</strong>
//             <span className="uns-tooltip-type">({getItemType(hoveredItem)})</span>
//           </div>
//           <div className="uns-tooltip-content">
//             <pre>{JSON.stringify(getItemData(hoveredItem), null, 2)}</pre>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // Plugin metadata
// export const pluginMetadata = {
//   name: 'Unified Namespace',
//   icon: null
// };

// export default UNSPage;

