import React, { useState } from 'react'
import {
  DndProvider,
  useDraggable,
  useDroppable,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop'

const Board = () => {
  const [columns, setColumns] = useState({
    toDo: {
      id: 'toDo',
      title: 'To Do',
      items: [
        { id: 'item1', content: 'Item 1' },
        { id: 'item2', content: 'Item 2' },
        { id: 'item3', content: 'Item 3' },
        { id: 'item4', content: 'Item 4' },
      ],
    },
    doing: {
      id: 'doing',
      title: 'Doing',
      items: [],
    },
    done: {
      id: 'done',
      title: 'Done',
      items: [],
    },
  })

  const handleDrop = ({ itemId, sourceColId, destColId, destIndex }) => {
    if (!destColId || !itemId) return
    const newColumns = { ...columns }
    const sourceItems = [...newColumns[sourceColId].items]
    const [movedItem] = sourceItems.splice(sourceItems.findIndex(i => i.id === itemId), 1)
    const destItems = [...newColumns[destColId].items]
    destItems.splice(destIndex, 0, movedItem)
    newColumns[sourceColId].items = sourceItems
    newColumns[destColId].items = destItems
    setColumns(newColumns)
  }

  return (
    <DndProvider monitor={monitorForElements}>
      <div className="flex gap-4">
        {Object.entries(columns).map(([columnId, column]) => (
          <Column
            key={columnId}
            column={column}
            columnId={columnId}
            handleDrop={handleDrop}
          />
        ))}
      </div>
    </DndProvider>
  )
}

const Column = ({ column, columnId, handleDrop }) => {
  const { setNodeRef } = useDroppable({
    id: columnId,
    onDrop: (data, monitor) => {
      handleDrop({
        itemId: data.id,
        sourceColId: data.sourceColId,
        destColId: columnId,
        destIndex: monitor.index,
      })
    },
  })

  return (
    <div ref={setNodeRef} className="w-64 bg-gray-100 p-2 rounded">
      <h2 className="text-2xl font-bold">{column.title}</h2>
      {column.items.map((item, index) => (
        <DraggableItem
          key={item.id}
          item={item}
          index={index}
          columnId={columnId}
        />
      ))}
    </div>
  )
}

const DraggableItem = ({ item, index, columnId }) => {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: item.id,
    data: { id: item.id, sourceColId: columnId },
    index,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white p-2 rounded my-2${isDragging ? ' opacity-50' : ''}`}
    >
      {item.content}
    </div>
  )
}

export default Board
